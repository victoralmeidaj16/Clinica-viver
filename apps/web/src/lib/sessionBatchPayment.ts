const monthFormatter = new Intl.DateTimeFormat('en-CA', {
  timeZone: 'America/Sao_Paulo', year: 'numeric', month: '2-digit',
});

export function sessionPaymentMonth(value: string | Date): string {
  const parts = monthFormatter.formatToParts(new Date(value));
  return `${parts.find((part) => part.type === 'year')!.value}-${parts.find((part) => part.type === 'month')!.value}`;
}

export function sessionBatchPaymentRule(starts: readonly string[], now = new Date()) {
  if (starts.length < 4) return { discountPercent: 0, error: undefined };
  const currentMonth = sessionPaymentMonth(now);
  if (starts.some((start) => sessionPaymentMonth(start) !== currentMonth)) {
    return { discountPercent: 0, error: 'Para pagar 4 ou mais sessões juntas, selecione somente sessões do mês vigente. Sessões de outros meses devem ser pagas separadamente.' };
  }
  return { discountPercent: 10, error: undefined };
}

/** Rateia o desconto com arredondamento acumulado para preservar 10% do total. */
export function priceSessionBatch(sessions: readonly { sessionStart: string; amountCents: number }[], now = new Date()) {
  const rule = sessionBatchPaymentRule(sessions.map((session) => session.sessionStart), now);
  if (rule.error) throw new Error(rule.error);
  let subtotalCents = 0;
  let allocatedDiscount = 0;
  const amounts = sessions.map((session) => {
    if (!Number.isSafeInteger(session.amountCents) || session.amountCents <= 0) throw new Error('Valor da sessão inválido.');
    subtotalCents += session.amountCents;
    const cumulativeDiscount = Math.round(subtotalCents * rule.discountPercent / 100);
    const discountCents = cumulativeDiscount - allocatedDiscount;
    allocatedDiscount = cumulativeDiscount;
    return session.amountCents - discountCents;
  });
  return { subtotalCents, discountCents: allocatedDiscount, amountCents: subtotalCents - allocatedDiscount, amounts };
}
