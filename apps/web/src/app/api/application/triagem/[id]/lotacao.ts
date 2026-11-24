import { NextResponse } from 'next/server';
import type { ResultadoLotacao } from '@/server/application/viverMaisRodizio';
import { avisarTransbordo } from '@/server/application/viverMaisWhatsApp';
import { avisarAlocacaoPsicologoPorEmail } from '@/server/application/triagemEmail';

export async function respostaLotacao(resultado: ResultadoLotacao) {
  const realocado = resultado.kind === 'capacity_reallocated';
  if (realocado) {
    await Promise.allSettled([
      avisarTransbordo(resultado.lead, resultado.psicologo, resultado.anteriorNome, 'limite_atingido'),
      avisarAlocacaoPsicologoPorEmail(resultado.lead, resultado.psicologo, 'RODIZIO'),
    ]);
  }
  return NextResponse.json({
    success: false,
    realocado,
    error: realocado
      ? 'Não há vaga disponível. A solicitação foi oferecida a outro profissional.'
      : 'Não há vaga disponível. A solicitação aguarda decisão da Gestão.',
  }, { status: 409 });
}
