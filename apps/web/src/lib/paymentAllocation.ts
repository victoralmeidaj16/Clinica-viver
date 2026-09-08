export interface ChargeAllocation { reference: string; amountCents: number; fullyPaid: boolean; }

/** Distribui uma liquidação agrupada sem creditar a uma sessão mais que seu valor. */
export function allocatePaymentAcrossCharges(
  paidCents: number,
  charges: readonly { reference: string; amountCents: number }[]
): ChargeAllocation[] {
  if (!Number.isSafeInteger(paidCents) || paidCents < 0) throw new Error('Valor pago inválido.');
  let remaining = paidCents;
  return charges.flatMap((charge) => {
    if (!Number.isSafeInteger(charge.amountCents) || charge.amountCents <= 0) throw new Error('Valor da cobrança inválido.');
    const amountCents = Math.min(remaining, charge.amountCents);
    remaining -= amountCents;
    return amountCents > 0
      ? [{ reference: charge.reference, amountCents, fullyPaid: amountCents === charge.amountCents }]
      : [];
  });
}
