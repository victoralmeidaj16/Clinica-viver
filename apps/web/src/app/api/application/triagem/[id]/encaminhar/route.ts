import { NextResponse } from 'next/server';
import { captureStateAsSnapshot, getCaptureRepository } from '@/server/persistence/captureRepository';
import { validarTokenConfirmacao } from '@/server/viverMaisConfirmToken';
import { encaminharParaProximo, type ResultadoEncaminhamento } from '@/server/application/viverMaisRodizio';
import { avisarTransbordo, avisarCoordenacao } from '@/server/application/viverMaisWhatsApp';
import { avisarAlocacaoPsicologoPorEmail } from '@/server/application/triagemEmail';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * Encaminhamento de solicitação de agendamento pelo psicólogo.
 *
 * Rota pública protegida por token assinado (HMAC). Permite que o psicólogo
 * devolva o lead para a fila caso não possa atender, acionando imediatamente
 * o próximo colega elegível sem esperar os 24h de estouro de SLA.
 */
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const url = new URL(request.url);
    const psicologoId = url.searchParams.get('psi');
    const token = url.searchParams.get('t');

    if (!psicologoId || !validarTokenConfirmacao(id, psicologoId, token)) {
      return NextResponse.json(
        { success: false, error: 'Link de encaminhamento inválido ou expirado.' },
        { status: 403 }
      );
    }

    const repositorio = getCaptureRepository();
    const resultado = await repositorio.mutate<ResultadoEncaminhamento>((state) => {
      const handled = encaminharParaProximo(captureStateAsSnapshot(state), id, psicologoId);
      return {
        next: {
          triagensPacientes: handled.snapshot?.triagensPacientes ?? [],
          cadastrosPsicologos: handled.snapshot?.cadastrosPsicologos ?? [],
        },
        result: handled,
      };
    });

    if (resultado.situacao === 'nao_encontrado') {
      return NextResponse.json({ success: false, error: 'Solicitação não encontrada.' }, { status: 404 });
    }

    if (resultado.situacao === 'nao_aplicavel') {
      return NextResponse.json(
        {
          success: false,
          error:
            'Este atendimento já foi confirmado ou não está mais atribuído a você (o prazo de 24h pode ter expirado).',
        },
        { status: 409 }
      );
    }

    if (resultado.situacao === 'sem_candidato') {
      const protocolo = resultado.lead?.protocolo || id;
      void avisarCoordenacao(
        [
          'Alerta operacional — encaminhamento sem destino.',
          `Protocolo: ${protocolo}`,
          'Profissional solicitou encaminhamento pelo link e não há outro profissional elegível no momento.',
          'O caso foi retido para decisão manual da coordenação.',
        ].join('\n'),
        `sem-candidato-link:${id}`
      );
      return NextResponse.json({
        success: true,
        situacao: 'sem_candidato',
        message: 'Atendimento devolvido para alocação manual pela coordenação da clínica.',
      });
    }

    // Encaminhado com sucesso ao próximo profissional
    if (resultado.psicologoNovo && resultado.lead) {
      void avisarTransbordo(
        resultado.lead,
        resultado.psicologoNovo,
        resultado.psicologoAnteriorNome,
        'encaminhamento_voluntario'
      );
      void avisarAlocacaoPsicologoPorEmail(resultado.lead, resultado.psicologoNovo, 'RODIZIO');
    }

    return NextResponse.json({
      success: true,
      situacao: 'encaminhado',
      message: 'Atendimento encaminhado com sucesso ao próximo profissional da fila.',
    });
  } catch (error) {
    console.error('Erro ao encaminhar atendimento:', error);
    return NextResponse.json({ success: false, error: 'Falha ao processar o encaminhamento.' }, { status: 500 });
  }
}
