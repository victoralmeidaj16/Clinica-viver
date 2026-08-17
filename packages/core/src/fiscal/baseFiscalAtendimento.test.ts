import { describe, expect, it } from 'vitest';
import { avaliarBaseFiscalAtendimento } from './baseFiscalAtendimento';

describe('base fiscal do atendimento', () => {
  it('usa o valor bruto do serviço, não o valor líquido recebido', () => {
    expect(avaliarBaseFiscalAtendimento({
      valorBrutoCents: 20_000,
      valorPagoConfirmadoCents: 19_120,
      valorEstornadoCents: 0,
      statusCobranca: 'paid',
    })).toEqual({ apta: true, valorCents: 20_000 });
  });

  it('encaminha qualquer estorno para revisão fiscal', () => {
    expect(avaliarBaseFiscalAtendimento({
      valorBrutoCents: 20_000,
      valorPagoConfirmadoCents: 20_000,
      valorEstornadoCents: 5_000,
      statusCobranca: 'refunded',
    })).toEqual({ apta: false, motivo: 'estorno_exige_revisao' });
  });

  it('exige pagamento confirmado e quitação integral', () => {
    expect(avaliarBaseFiscalAtendimento({
      valorBrutoCents: 20_000,
      valorPagoConfirmadoCents: 0,
      valorEstornadoCents: 0,
      statusCobranca: 'pending',
    })).toMatchObject({ apta: false, motivo: 'sem_pagamento_confirmado' });
    expect(avaliarBaseFiscalAtendimento({
      valorBrutoCents: 20_000,
      valorPagoConfirmadoCents: 10_000,
      valorEstornadoCents: 0,
      statusCobranca: 'partially_paid',
    })).toMatchObject({ apta: false, motivo: 'cobranca_nao_quitada' });
  });
});
