import {
  filterChargesByIssuedPeriod,
  filterChargesByScope,
  isFinancialEventInPeriod,
} from './filters';
import {
  deriveChargeStatus,
  reconcileSessionReceivables,
} from './reconciliation';
import type {
  CashFlowEntry,
  CashFlowReport,
  DelinquencyReport,
  FinancialFilter,
  FinancialLedger,
  FinancialReportBundle,
  FinancialSummaryReport,
  SessionReceivable,
  TransferReport,
} from './types';
import { assertIsoDate, sumMoney } from './validation';

function getScopedReceivables(
  ledger: FinancialLedger,
  filter: FinancialFilter,
  asOf: string
): SessionReceivable[] {
  const scopedCharges = filterChargesByScope(ledger, filter);
  const periodChargeIds = new Set(
    filterChargesByIssuedPeriod(scopedCharges, filter).map(({ id }) => id)
  );

  return reconcileSessionReceivables(ledger)
    .filter(({ chargeId }) => periodChargeIds.has(chargeId))
    .filter((receivable) => {
      const status = deriveChargeStatus(receivable, asOf);
      return !filter.chargeStatuses || filter.chargeStatuses.includes(status);
    })
    .map((receivable) => ({
      ...receivable,
      chargeStatus: deriveChargeStatus(receivable, asOf),
    }));
}

function buildCashFlow(
  ledger: FinancialLedger,
  scopedChargeIds: ReadonlySet<string>,
  filter: FinancialFilter
): CashFlowReport {
  const scopedPaymentIds = new Set(
    ledger.payments
      .filter(({ chargeId }) => scopedChargeIds.has(chargeId))
      .map(({ id }) => id)
  );
  const entries: CashFlowEntry[] = [
    ...ledger.payments
      .filter(
        (payment) =>
          scopedChargeIds.has(payment.chargeId) &&
          payment.status === 'confirmed' &&
          isFinancialEventInPeriod(payment.receivedAt, filter)
      )
      .map((payment) => ({
        id: payment.id,
        date: payment.receivedAt,
        type: 'payment' as const,
        description: `Pagamento da cobrança ${payment.chargeId}`,
        amountCents: payment.amountCents,
      })),
    ...ledger.refunds
      .filter(
        (refund) =>
          scopedPaymentIds.has(refund.paymentId) &&
          isFinancialEventInPeriod(refund.refundedAt, filter)
      )
      .map((refund) => ({
        id: refund.id,
        date: refund.refundedAt,
        type: 'refund' as const,
        description: `Estorno do pagamento ${refund.paymentId}`,
        amountCents: -refund.amountCents,
      })),
    ...ledger.fees
      .filter(
        (fee) =>
          (!filter.organizationId ||
            fee.organizationId === filter.organizationId) &&
          (!fee.chargeId || scopedChargeIds.has(fee.chargeId)) &&
          isFinancialEventInPeriod(fee.incurredAt, filter)
      )
      .map((fee) => ({
        id: fee.id,
        date: fee.incurredAt,
        type: 'fee' as const,
        description: fee.description,
        amountCents: -fee.amountCents,
      })),
    ...ledger.transfers
      .filter(
        (transfer) =>
          scopedChargeIds.has(transfer.chargeId) &&
          transfer.status === 'paid' &&
          Boolean(transfer.paidAt) &&
          isFinancialEventInPeriod(transfer.paidAt as string, filter)
      )
      .map((transfer) => ({
        id: transfer.id,
        date: transfer.paidAt as string,
        type: 'transfer' as const,
        description: `Repasse ao profissional ${transfer.professionalId}`,
        amountCents: -transfer.amountCents,
      })),
  ].sort((left, right) => left.date.localeCompare(right.date));

  const inflowCents = sumMoney(
    entries.filter(({ amountCents }) => amountCents > 0).map(({ amountCents }) => amountCents)
  );
  const outflowCents = Math.abs(
    sumMoney(
      entries.filter(({ amountCents }) => amountCents < 0).map(({ amountCents }) => amountCents)
    )
  );

  return {
    entries,
    inflowCents,
    outflowCents,
    balanceCents: inflowCents - outflowCents,
  };
}

function buildDelinquencyReport(
  receivables: readonly SessionReceivable[],
  asOf: string
): DelinquencyReport {
  const overdue = receivables.filter(
    (receivable) => deriveChargeStatus(receivable, asOf) === 'overdue'
  );
  const eligibleAmountCents = sumMoney(
    receivables
      .filter(({ reconciliationStatus }) => reconciliationStatus !== 'cancelled')
      .map(({ netAmountCents }) => netAmountCents)
  );
  const overdueCents = sumMoney(
    overdue.map(({ outstandingAmountCents }) => outstandingAmountCents)
  );

  return {
    asOf,
    receivables: overdue,
    overdueCount: overdue.length,
    overdueCents,
    delinquencyRate:
      eligibleAmountCents === 0 ? 0 : overdueCents / eligibleAmountCents,
  };
}

function buildTransferReport(
  ledger: FinancialLedger,
  scopedChargeIds: ReadonlySet<string>,
  filter: FinancialFilter
): TransferReport {
  const transfers = ledger.transfers.filter(
    (transfer) =>
      scopedChargeIds.has(transfer.chargeId) &&
      isFinancialEventInPeriod(transfer.paidAt ?? transfer.dueAt, filter)
  );

  return {
    transfers,
    pendingCents: sumMoney(
      transfers
        .filter(({ status }) => status === 'pending')
        .map(({ amountCents }) => amountCents)
    ),
    paidCents: sumMoney(
      transfers
        .filter(({ status }) => status === 'paid')
        .map(({ amountCents }) => amountCents)
    ),
  };
}

export function generateFinancialReports(
  ledger: FinancialLedger,
  filter: FinancialFilter = {},
  generatedAt = new Date().toISOString()
): FinancialReportBundle {
  assertIsoDate(generatedAt, 'generatedAt');
  if (filter.startDate) assertIsoDate(filter.startDate, 'startDate');
  if (filter.endDate) assertIsoDate(filter.endDate, 'endDate');
  if (
    filter.startDate &&
    filter.endDate &&
    Date.parse(filter.startDate) > Date.parse(filter.endDate)
  ) {
    throw new Error('startDate não pode ser posterior a endDate.');
  }
  const statusByChargeId = new Map(
    reconcileSessionReceivables(ledger).map((receivable) => [
      receivable.chargeId,
      deriveChargeStatus(receivable, generatedAt),
    ])
  );
  const scopedCharges = filterChargesByScope(ledger, filter).filter(
    ({ id }) =>
      !filter.chargeStatuses ||
      filter.chargeStatuses.includes(statusByChargeId.get(id) ?? 'pending')
  );
  const scopedChargeIds = new Set(scopedCharges.map(({ id }) => id));
  const receivables = getScopedReceivables(ledger, filter, generatedAt);
  const cashFlow = buildCashFlow(ledger, scopedChargeIds, filter);
  const delinquency = buildDelinquencyReport(receivables, generatedAt);
  const transfers = buildTransferReport(
    ledger,
    scopedChargeIds,
    filter
  );
  const activeReceivables = receivables.filter(
    ({ reconciliationStatus }) => reconciliationStatus !== 'cancelled'
  );
  const summary: FinancialSummaryReport = {
    generatedAt,
    period: { startDate: filter.startDate, endDate: filter.endDate },
    chargeCount: activeReceivables.length,
    settledChargeCount: activeReceivables.filter(
      ({ reconciliationStatus }) =>
        reconciliationStatus === 'settled' ||
        reconciliationStatus === 'overpaid'
    ).length,
    overdueChargeCount: delinquency.overdueCount,
    grossBilledCents: sumMoney(
      activeReceivables.map(({ grossAmountCents }) => grossAmountCents)
    ),
    discountsCents: sumMoney(
      activeReceivables.map(({ discountAmountCents }) => discountAmountCents)
    ),
    netBilledCents: sumMoney(
      activeReceivables.map(({ netAmountCents }) => netAmountCents)
    ),
    receivedCents: cashFlow.inflowCents,
    refundsCents: Math.abs(
      sumMoney(
        cashFlow.entries
          .filter(({ type }) => type === 'refund')
          .map(({ amountCents }) => amountCents)
      )
    ),
    feesCents: Math.abs(
      sumMoney(
        cashFlow.entries
          .filter(({ type }) => type === 'fee')
          .map(({ amountCents }) => amountCents)
      )
    ),
    transfersPaidCents: transfers.paidCents,
    netCashCents: cashFlow.balanceCents,
    outstandingCents: sumMoney(
      activeReceivables.map(({ outstandingAmountCents }) => outstandingAmountCents)
    ),
    overdueCents: delinquency.overdueCents,
    delinquencyRate: delinquency.delinquencyRate,
  };

  return { summary, receivables, cashFlow, delinquency, transfers };
}
