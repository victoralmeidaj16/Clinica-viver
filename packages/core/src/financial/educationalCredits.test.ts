import { describe, expect, it } from 'vitest';
import type { FinancialCharge, FinancialLedger, FinancialPayment } from './types';
import { listEducationalCreditLines } from './educationalCredits';

/**
 * Créditos Educacionais (especificação final, §§ 10.07, 11.01, 11.02 e 11.04).
 * Pagamento do paciente: 70% no mês do recebimento. Sessão custeada por
 * empresa: 70% do valor da sessão no mês da confirmação, sem depender do
 * boleto; a quitação posterior da empresa não gera outro crédito.
 */

const cobranca = (id: string, mudancas: Partial<FinancialCharge> = {}): FinancialCharge => ({
  id,
  organizationId: 'org-ficticia',
  sessionId: `sessao-${id}`,
  patientId: 'paciente-ficticio',
  professionalId: 'profissional-a',
  issuedAt: '2026-10-20T12:00:00.000Z',
  dueAt: '2026-10-27T12:00:00.000Z',
  amountCents: 10_000,
  status: 'pending',
  createdAt: '2026-10-20T12:00:00.000Z',
  updatedAt: '2026-10-20T12:00:00.000Z',
  ...mudancas,
});

const pagamento = (id: string, chargeId: string, receivedAt: string, amountCents = 10_000): FinancialPayment => ({
  id, chargeId, receivedAt, amountCents, method: 'pix', status: 'confirmed',
});

const razao = (charges: FinancialCharge[], payments: FinancialPayment[]): FinancialLedger => ({
  charges, payments, discounts: [], refunds: [], fees: [], transfers: [],
});

const NOVEMBRO = { startDate: '2026-11-01T03:00:00.000Z', endDate: '2026-12-01T02:59:59.999Z' };
const DEZEMBRO = { startDate: '2026-12-01T03:00:00.000Z', endDate: '2027-01-01T02:59:59.999Z' };

describe('créditos educacionais', () => {
  it('pagamento do paciente gera 70% no mês em que foi recebido', () => {
    const ledger = razao([cobranca('sessao-particular')], [pagamento('pix-1', 'sessao-particular', '2026-11-05T12:00:00.000Z')]);

    expect(listEducationalCreditLines(ledger, NOVEMBRO)).toEqual([expect.objectContaining({
      source: 'payment', chargeId: 'sessao-particular', occurredAt: '2026-11-05T12:00:00.000Z',
      baseCents: 10_000, creditCents: 7_000, professionalId: 'profissional-a',
    })]);
  });

  it.each([[10_000, 7_000], [12_000, 8_400]])('contrato de %i centavos gera %i de crédito no mês da confirmação, uma única vez', (valor, credito) => {
    // Sessão de outubro confirmada em novembro; a empresa paga o boleto em dezembro.
    const ledger = razao(
      [cobranca('sessao-empresa', { payer: 'company', issuedAt: '2026-11-10T12:00:00.000Z', amountCents: valor, status: 'paid' })],
      [pagamento('boleto-empresa', 'sessao-empresa', '2026-12-15T12:00:00.000Z', valor)]
    );

    expect(listEducationalCreditLines(ledger, NOVEMBRO)).toEqual([expect.objectContaining({
      source: 'company_session', chargeId: 'sessao-empresa', occurredAt: '2026-11-10T12:00:00.000Z',
      baseCents: valor, creditCents: credito,
    })]);
    expect(listEducationalCreditLines(ledger, DEZEMBRO)).toEqual([]);
  });

  it('sessão da empresa cancelada não gera crédito', () => {
    const ledger = razao([cobranca('sessao-cancelada', { payer: 'company', issuedAt: '2026-11-10T12:00:00.000Z', status: 'cancelled' })], []);
    expect(listEducationalCreditLines(ledger, NOVEMBRO)).toEqual([]);
  });

  it('pagamento cancelado não gera crédito e o filtro por profissional é respeitado', () => {
    const ledger = razao(
      [cobranca('de-a'), cobranca('de-b', { professionalId: 'profissional-b' })],
      [
        { ...pagamento('cancelado', 'de-a', '2026-11-05T12:00:00.000Z'), status: 'cancelled' },
        pagamento('pix-b', 'de-b', '2026-11-06T12:00:00.000Z'),
      ]
    );

    expect(listEducationalCreditLines(ledger, { ...NOVEMBRO, professionalIds: ['profissional-a'] })).toEqual([]);
    expect(listEducationalCreditLines(ledger, { ...NOVEMBRO, professionalIds: ['profissional-b'] })).toHaveLength(1);
  });
});
