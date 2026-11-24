import { dividirSplit7030Centavos } from '../viverMaisAsaasService';
import { isFinancialEventInPeriod } from './filters';
import type { FinancialFilter, FinancialLedger, PaymentMethod } from './types';

/**
 * Créditos Educacionais: uma regra só, usada pelo extrato do psicólogo e pelo
 * painel da Gestão (especificação final, §§ 10.07, 11.01, 11.02 e 11.04).
 *
 * - Pagamento do paciente: 70% de cada valor recebido, no mês do recebimento.
 * - Sessão custeada por empresa: 70% do valor da sessão no mês em que o
 *   psicólogo confirmou a realização — é quando a cobrança empresarial nasce —,
 *   sem depender do boleto. A quitação da empresa não gera outro crédito.
 *
 * Estorno não reverte crédito automaticamente: o ajuste é decisão da Gestão
 * (§§ 9.07 e 11.07).
 */
export interface EducationalCreditLine {
  id: string;
  source: 'payment' | 'company_session';
  chargeId: string;
  sessionId: string;
  patientId: string;
  professionalId: string;
  /** Competência: recebimento do pagamento ou confirmação da sessão custeada. */
  occurredAt: string;
  baseCents: number;
  creditCents: number;
  paymentMethod?: PaymentMethod;
}

export function listEducationalCreditLines(
  ledger: FinancialLedger,
  filter: FinancialFilter = {}
): EducationalCreditLine[] {
  const doFiltro = (charge: { professionalId: string; patientId: string }) =>
    (!filter.professionalIds?.length || filter.professionalIds.includes(charge.professionalId)) &&
    (!filter.patientIds?.length || filter.patientIds.includes(charge.patientId));
  const cobrancas = new Map(ledger.charges.map((charge) => [charge.id, charge]));
  const linhas: EducationalCreditLine[] = [];

  for (const payment of ledger.payments) {
    if (payment.status !== 'confirmed') continue;
    const charge = cobrancas.get(payment.chargeId);
    // A quitação da empresa não gera crédito: ele já nasceu na confirmação.
    if (!charge || charge.payer === 'company' || !doFiltro(charge)) continue;
    if (!isFinancialEventInPeriod(payment.receivedAt, filter)) continue;
    linhas.push({
      id: payment.id,
      source: 'payment',
      chargeId: charge.id,
      sessionId: charge.sessionId,
      patientId: charge.patientId,
      professionalId: charge.professionalId,
      occurredAt: payment.receivedAt,
      baseCents: payment.amountCents,
      creditCents: dividirSplit7030Centavos(payment.amountCents).creditoPsicologoCents,
      paymentMethod: payment.method,
    });
  }

  for (const charge of ledger.charges) {
    if (charge.payer !== 'company' || charge.status === 'cancelled' || !doFiltro(charge)) continue;
    if (!isFinancialEventInPeriod(charge.issuedAt, filter)) continue;
    linhas.push({
      id: `${charge.id}:sessao-custeada`,
      source: 'company_session',
      chargeId: charge.id,
      sessionId: charge.sessionId,
      patientId: charge.patientId,
      professionalId: charge.professionalId,
      occurredAt: charge.issuedAt,
      baseCents: charge.amountCents,
      creditCents: dividirSplit7030Centavos(charge.amountCents).creditoPsicologoCents,
    });
  }

  return linhas.sort((first, second) => second.occurredAt.localeCompare(first.occurredAt));
}
