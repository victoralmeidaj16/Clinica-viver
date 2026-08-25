export type SessionChargeDecision =
  | { create: true; amountCents: number }
  | { create: false; reason: 'company_funded' | 'missing_amount' };

/** Regra pura que antecede qualquer INSERT financeiro. */
export function decideSessionCharge(input: {
  amountCents: unknown;
  companyFunded: boolean;
}): SessionChargeDecision {
  if (input.companyFunded) return { create: false, reason: 'company_funded' };
  const amountCents = Number(input.amountCents);
  if (!Number.isInteger(amountCents) || amountCents <= 0) {
    return { create: false, reason: 'missing_amount' };
  }
  return { create: true, amountCents };
}
