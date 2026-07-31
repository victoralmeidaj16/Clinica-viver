import type {
  FinancialCharge,
  FinancialFilter,
  FinancialLedger,
} from './types';

function isWithinPeriod(
  value: string,
  startDate?: string,
  endDate?: string
): boolean {
  const timestamp = Date.parse(value);
  return (
    (!startDate || timestamp >= Date.parse(startDate)) &&
    (!endDate || timestamp <= Date.parse(endDate))
  );
}

export function filterChargesByScope(
  ledger: FinancialLedger,
  filter: FinancialFilter
): FinancialCharge[] {
  return ledger.charges.filter((charge) => {
    const paymentMethods = ledger.payments
      .filter(({ chargeId, status }) => chargeId === charge.id && status === 'confirmed')
      .map(({ method }) => method);

    return (
      (!filter.organizationId ||
        charge.organizationId === filter.organizationId) &&
      (!filter.patientIds || filter.patientIds.includes(charge.patientId)) &&
      (!filter.professionalIds ||
        filter.professionalIds.includes(charge.professionalId)) &&
      (!filter.paymentMethods ||
        paymentMethods.some((method) => filter.paymentMethods?.includes(method)) ||
        (charge.paymentMethod
          ? filter.paymentMethods.includes(charge.paymentMethod)
          : false))
    );
  });
}

export function filterChargesByIssuedPeriod(
  charges: readonly FinancialCharge[],
  filter: FinancialFilter
): FinancialCharge[] {
  return charges.filter(({ issuedAt }) =>
    isWithinPeriod(issuedAt, filter.startDate, filter.endDate)
  );
}

export function isFinancialEventInPeriod(
  date: string,
  filter: FinancialFilter
): boolean {
  return isWithinPeriod(date, filter.startDate, filter.endDate);
}
