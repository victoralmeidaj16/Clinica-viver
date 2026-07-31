import type { FinancialLedger } from './types';
import { assertIsoDate, assertMoney } from './validation';

function assertUniqueIds(
  collection: readonly { id: string }[],
  label: string
): void {
  const ids = new Set(collection.map(({ id }) => id));
  if (ids.size !== collection.length) {
    throw new Error(`Os IDs de ${label} devem ser únicos.`);
  }
}

export function validateFinancialLedger(ledger: FinancialLedger): void {
  assertUniqueIds(ledger.charges, 'cobranças');
  assertUniqueIds(ledger.discounts, 'descontos');
  assertUniqueIds(ledger.payments, 'pagamentos');
  assertUniqueIds(ledger.refunds, 'estornos');
  assertUniqueIds(ledger.fees, 'taxas');
  assertUniqueIds(ledger.transfers, 'repasses');

  const chargeIds = new Set(ledger.charges.map(({ id }) => id));
  const paymentIds = new Set(ledger.payments.map(({ id }) => id));
  const activeSessions = ledger.charges
    .filter(({ status }) => status !== 'cancelled')
    .map(({ organizationId, sessionId }) => `${organizationId}:${sessionId}`);
  if (new Set(activeSessions).size !== activeSessions.length) {
    throw new Error('Cada sessão pode possuir somente uma cobrança ativa.');
  }

  for (const charge of ledger.charges) {
    assertMoney(charge.amountCents, `Cobrança ${charge.id}`);
    assertIsoDate(charge.issuedAt, `issuedAt da cobrança ${charge.id}`);
    assertIsoDate(charge.dueAt, `dueAt da cobrança ${charge.id}`);
  }
  for (const discount of ledger.discounts) {
    if (!chargeIds.has(discount.chargeId)) {
      throw new Error(`Desconto ${discount.id} referencia cobrança inexistente.`);
    }
    assertMoney(discount.amountCents, `Desconto ${discount.id}`);
    assertIsoDate(discount.appliedAt, `appliedAt do desconto ${discount.id}`);
  }
  for (const payment of ledger.payments) {
    if (!chargeIds.has(payment.chargeId)) {
      throw new Error(`Pagamento ${payment.id} referencia cobrança inexistente.`);
    }
    assertMoney(payment.amountCents, `Pagamento ${payment.id}`);
    assertIsoDate(payment.receivedAt, `receivedAt do pagamento ${payment.id}`);
  }
  for (const refund of ledger.refunds) {
    if (!paymentIds.has(refund.paymentId)) {
      throw new Error(`Estorno ${refund.id} referencia pagamento inexistente.`);
    }
    assertMoney(refund.amountCents, `Estorno ${refund.id}`);
    assertIsoDate(refund.refundedAt, `refundedAt do estorno ${refund.id}`);
  }
  for (const fee of ledger.fees) {
    if (fee.chargeId && !chargeIds.has(fee.chargeId)) {
      throw new Error(`Taxa ${fee.id} referencia cobrança inexistente.`);
    }
    if (fee.paymentId && !paymentIds.has(fee.paymentId)) {
      throw new Error(`Taxa ${fee.id} referencia pagamento inexistente.`);
    }
    assertMoney(fee.amountCents, `Taxa ${fee.id}`);
    assertIsoDate(fee.incurredAt, `incurredAt da taxa ${fee.id}`);
  }
  for (const transfer of ledger.transfers) {
    if (!chargeIds.has(transfer.chargeId)) {
      throw new Error(`Repasse ${transfer.id} referencia cobrança inexistente.`);
    }
    if (transfer.status === 'paid' && !transfer.paidAt) {
      throw new Error(`Repasse pago ${transfer.id} exige paidAt.`);
    }
    assertMoney(transfer.amountCents, `Repasse ${transfer.id}`);
    assertIsoDate(transfer.dueAt, `dueAt do repasse ${transfer.id}`);
    if (transfer.paidAt) {
      assertIsoDate(transfer.paidAt, `paidAt do repasse ${transfer.id}`);
    }
  }
}
