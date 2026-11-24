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

    const corpo = (await request.json().catch(() => null)) as { motivo?: unknown } | null;
    const motivo = typeof corpo?.motivo === 'string' ? corpo.motivo.trim().slice(0, 300) || undefined : undefined;

    const repositorio = getCaptureRepository();
    const resultado = await repositorio.mutate<ResultadoEncaminhamento>((state) => {
      const handled = motivo
        ? encaminharParaProximo(captureStateAsSnapshot(state), id, psicologoId, new Date(), motivo)
        : encaminharParaProximo(captureStateAsSnapshot(state), id, psicologoId);
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
            'Este atendimento já foi confirmado ou não está mais atribuído a você (o prazo de resposta pode ter expirado).',
        },
        { status: 409 }
      );
    }

    if (resultado.situacao === 'ja_aceito') {
      return NextResponse.json(
        {
          success: false,
          error:
            'Você já aceitou este paciente, então este link não pode mais encaminhá-lo. Para repassá-lo a outro profissional, fale com a coordenação da clínica.',
        },
        { status: 409 }
      );
    }

    if (resultado.situacao === 'devolvido_gestao') {
      const protocolo = resultado.lead?.protocolo || id;
      void avisarCoordenacao(
        [
          'Alerta operacional — pedido para profissional específico recusado.',
          `Protocolo: ${protocolo}`,
          'O paciente escolheu este profissional na vitrine, e ele recusou pelo link.',
          ...(motivo ? [`Motivo informado: ${motivo}`] : []),
          'O caso não foi redistribuído: aguarda a coordenação encaminhar ou devolver ao rodízio.',
        ].join('\n'),
        `escolha-direta-recusada:${id}`
      );
      return NextResponse.json({
        success: true,
        situacao: 'devolvido_gestao',
        message: 'Recusa registrada. Como o paciente escolheu você, a coordenação da clínica vai decidir o encaminhamento.',
      });
    }

    if (resultado.situacao === 'sem_candidato') {
      const protocolo = resultado.lead?.protocolo || id;
      void avisarCoordenacao(
        [
          'Alerta operacional — encaminhamento sem destino.',
          `Protocolo: ${protocolo}`,
          'Profissional solicitou encaminhamento pelo link e não há outro profissional elegível no momento.',
          ...(motivo ? [`Motivo informado: ${motivo}`] : []),
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
