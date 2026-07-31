import type {
  ChargeStatus,
  FinancialLedger,
  SessionReceivable,
} from './types';
import { validateFinancialLedger } from './ledgerValidation';
import { assertMoney, sumMoney } from './validation';

function groupBy<T>(
  values: readonly T[],
  getKey: (value: T) => string
): Map<string, T[]> {
  const grouped = new Map<string, T[]>();
  for (const value of values) {
    const key = getKey(value);
    grouped.set(key, [...(grouped.get(key) ?? []), value]);
  }
  return grouped;
}

function resolveReconciliationStatus(
  chargeStatus: ChargeStatus,
  effectivePaidCents: number,
  netAmountCents: number,
  refundedAmountCents: number
): SessionReceivable['reconciliationStatus'] {
  if (chargeStatus === 'cancelled') return 'cancelled';
  if (refundedAmountCents > 0 && effectivePaidCents === 0) return 'refunded';
  if (effectivePaidCents > netAmountCents) return 'overpaid';
  if (effectivePaidCents === netAmountCents) return 'settled';
  if (effectivePaidCents > 0) return 'partial';
  return 'unpaid';
}

export function reconcileSessionReceivables(
  ledger: FinancialLedger
): SessionReceivable[] {
  validateFinancialLedger(ledger);

  const discountsByCharge = groupBy(ledger.discounts, ({ chargeId }) => chargeId);
  const paymentsByCharge = groupBy(ledger.payments, ({ chargeId }) => chargeId);
  const refundsByPayment = groupBy(ledger.refunds, ({ paymentId }) => paymentId);
  const feesByCharge = groupBy(
    ledger.fees.filter((fee) => fee.chargeId),
    (fee) => fee.chargeId as string
  );
  const transfersByCharge = groupBy(ledger.transfers, ({ chargeId }) => chargeId);

  return ledger.charges.map((charge) => {
    assertMoney(charge.amountCents, `Cobrança ${charge.id}`);
    const discountAmountCents = sumMoney(
      (discountsByCharge.get(charge.id) ?? []).map(({ amountCents }) => amountCents)
    );
    if (discountAmountCents > charge.amountCents) {
      throw new Error(`Descontos excedem o valor da cobrança ${charge.id}.`);
    }

    const confirmedPayments = (paymentsByCharge.get(charge.id) ?? []).filter(
      ({ status }) => status === 'confirmed'
    );
    const paidAmountCents = sumMoney(
      confirmedPayments.map(({ amountCents }) => amountCents)
    );
    const refundedAmountCents = sumMoney(
      confirmedPayments.flatMap((payment) =>
        (refundsByPayment.get(payment.id) ?? []).map(({ amountCents }) => amountCents)
      )
    );
    if (refundedAmountCents > paidAmountCents) {
      throw new Error(`Estornos excedem os pagamentos da cobrança ${charge.id}.`);
    }

    const netAmountCents = charge.amountCents - discountAmountCents;
    const effectivePaidCents = paidAmountCents - refundedAmountCents;
    const outstandingAmountCents = Math.max(
      netAmountCents - effectivePaidCents,
      0
    );
    const reconciliationStatus = resolveReconciliationStatus(
      charge.status,
      effectivePaidCents,
      netAmountCents,
      refundedAmountCents
    );

    return {
      sessionId: charge.sessionId,
      chargeId: charge.id,
      patientId: charge.patientId,
      professionalId: charge.professionalId,
      dueAt: charge.dueAt,
      chargeStatus: charge.status,
      reconciliationStatus,
      grossAmountCents: charge.amountCents,
      discountAmountCents,
      netAmountCents,
      paidAmountCents,
      refundedAmountCents,
      outstandingAmountCents:
        charge.status === 'cancelled' || reconciliationStatus === 'refunded'
          ? 0
          : outstandingAmountCents,
      feeAmountCents: sumMoney(
        (feesByCharge.get(charge.id) ?? []).map(({ amountCents }) => amountCents)
      ),
      transferAmountCents: sumMoney(
        (transfersByCharge.get(charge.id) ?? [])
          .filter(({ status }) => status !== 'cancelled')
          .map(({ amountCents }) => amountCents)
      ),
    };
  });
}

export function deriveChargeStatus(
  receivable: SessionReceivable,
  asOf: string
): ChargeStatus {
  if (receivable.chargeStatus === 'cancelled') return 'cancelled';
  if (receivable.reconciliationStatus === 'refunded') return 'refunded';
  if (
    receivable.reconciliationStatus === 'settled' ||
    receivable.reconciliationStatus === 'overpaid'
  ) {
    return 'paid';
  }
  if (
    receivable.outstandingAmountCents > 0 &&
    Date.parse(receivable.dueAt) < Date.parse(asOf)
  ) {
    return 'overdue';
  }
  if (receivable.reconciliationStatus === 'partial') return 'partially_paid';
  return 'pending';
}
