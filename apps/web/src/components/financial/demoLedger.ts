import type { FinancialLedger } from '@thats-life/core';

export const people = {
  patients: {} as Record<string, string>,
  professionals: {} as Record<string, string>,
};

export const demoLedger: FinancialLedger = {
  charges: [],
  discounts: [],
  payments: [],
  refunds: [],
  fees: [],
  transfers: [],
};
