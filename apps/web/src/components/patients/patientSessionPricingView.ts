export type SessionPricingCategory = 'acessivel' | 'particular' | 'personalizado';

export const sessionPricingLabels: Record<SessionPricingCategory, string> = {
  acessivel: 'Acessível',
  particular: 'Particular',
  personalizado: 'Personalizado',
};

export function formatCents(cents: number): string {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(cents / 100);
}

export function parseReaisToCents(value: string): number | null {
  const normalized = value.trim().replace(/^R\$\s*/i, '').replace(/\./g, '').replace(',', '.');
  if (!normalized || !/^\d+(?:\.\d{1,2})?$/.test(normalized)) return null;
  const cents = Math.round(Number(normalized) * 100);
  return Number.isSafeInteger(cents) && cents > 0 ? cents : null;
}
