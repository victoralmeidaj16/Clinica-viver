import { NextResponse } from 'next/server';
import { captureStateAsSnapshot, getCaptureRepository } from '@/server/persistence/captureRepository';
import { devolverAoRodizio, type ResultadoDevolucaoRodizio } from '@/server/application/viverMaisRodizio';
import { avisarAlocacao } from '@/server/application/viverMaisWhatsApp';
import { avisarAlocacaoPsicologoPorEmail } from '@/server/application/triagemEmail';
import { exigirGestao, NaoAutorizadoError } from '@/server/viverMaisGestaoAuth';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * "Devolver à fila" da Gestão: o caso que aguarda decisão volta ao rodízio
 * automático, sem ser oferecido de novo a quem já recusou ou não respondeu.
 */
export async function POST(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    await exigirGestao();
    const { id } = await params;

    const resultado = await getCaptureRepository().mutate<ResultadoDevolucaoRodizio>((state) => {
      const handled = devolverAoRodizio(captureStateAsSnapshot(state), id);
      return {
        next: {
          triagensPacientes: handled.snapshot.triagensPacientes ?? [],
          cadastrosPsicologos: handled.snapshot.cadastrosPsicologos ?? [],
        },
        result: handled,
      };
    });

    if (resultado.situacao === 'nao_encontrado') {
      return NextResponse.json({ success: false, error: 'Solicitação não encontrada.' }, { status: 404 });
    }
    if (resultado.situacao === 'nao_aplicavel') {
      return NextResponse.json(
        { success: false, error: 'Esta solicitação não está aguardando decisão da gestão. Recarregue a fila.' },
        { status: 409 }
      );
    }
    if (resultado.situacao !== 'alocado') {
      return NextResponse.json({
        success: true,
        situacao: 'sem_candidato',
        message: 'Nenhum outro profissional compatível no momento. O caso continua aguardando a gestão.',
      });
    }

    await Promise.allSettled([
      avisarAlocacao(resultado.lead, resultado.psicologo),
      avisarAlocacaoPsicologoPorEmail(resultado.lead, resultado.psicologo, 'RODIZIO'),
    ]);
    return NextResponse.json({ success: true, situacao: 'alocado', data: resultado.lead });
  } catch (error) {
    if (error instanceof NaoAutorizadoError) {
      return NextResponse.json({ success: false, error: error.message }, { status: error.status });
    }
    console.error('Erro ao devolver solicitação ao rodízio:', error);
    return NextResponse.json({ success: false, error: 'Falha ao devolver ao rodízio.' }, { status: 500 });
  }
}
