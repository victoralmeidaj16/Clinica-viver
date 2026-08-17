import type { ChargeStatus } from '../financial/types';

export type AvaliacaoBaseFiscalAtendimento =
  | { apta: true; valorCents: number }
  | { apta: false; motivo: 'sem_pagamento_confirmado' | 'estorno_exige_revisao' | 'cobranca_nao_quitada' };

/**
 * Decide a base de uma NFS-e sem misturar o valor do serviço com o fluxo do dinheiro.
 * Taxas, split e repasse ficam deliberadamente fora da entrada: a nota documenta
 * o atendimento prestado, cujo valor bruto está na cobrança.
 */
export function avaliarBaseFiscalAtendimento(input: {
  valorBrutoCents: number;
  valorPagoConfirmadoCents: number;
  valorEstornadoCents: number;
  statusCobranca: ChargeStatus;
}): AvaliacaoBaseFiscalAtendimento {
  if (input.valorPagoConfirmadoCents <= 0) {
    return { apta: false, motivo: 'sem_pagamento_confirmado' };
  }
  if (input.valorEstornadoCents > 0) {
    return { apta: false, motivo: 'estorno_exige_revisao' };
  }
  if (input.statusCobranca !== 'paid') {
    return { apta: false, motivo: 'cobranca_nao_quitada' };
  }
  return { apta: true, valorCents: input.valorBrutoCents };
}
