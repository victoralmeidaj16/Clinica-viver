const PHONE_DIGITS = /^\d+$/;

/** Normaliza telefone brasileiro para DDI + DDD + número, somente dígitos. */
export function normalizeBrazilPhone(value: unknown): string | null {
  const source = String(value ?? '').trim();
  if (!/^\+?[\d\s().-]+$/.test(source)) return null;
  const digits = source.replace(/\D/g, '');
  if (!PHONE_DIGITS.test(digits)) return null;
  if ((digits.length === 12 || digits.length === 13) && digits.startsWith('55')) return digits;
  if (digits.length === 10 || digits.length === 11) return `55${digits}`;
  return null;
}

export function formatBrazilPhone(value: string): string {
  const normalized = normalizeBrazilPhone(value);
  if (!normalized) return value;
  const national = normalized.slice(2);
  const ddd = national.slice(0, 2);
  const number = national.slice(2);
  return number.length === 9
    ? `+55 (${ddd}) ${number.slice(0, 5)}-${number.slice(5)}`
    : `+55 (${ddd}) ${number.slice(0, 4)}-${number.slice(4)}`;
}

export function maskBrazilPhoneInput(value: string): string {
  const digits = value.replace(/\D/g, '').replace(/^55(?=\d{10,11}$)/, '').slice(0, 11);
  if (digits.length <= 2) return digits ? `(${digits}` : '';
  const ddd = digits.slice(0, 2);
  const number = digits.slice(2);
  if (number.length <= 4) return `(${ddd}) ${number}`;
  const split = number.length > 8 ? 5 : 4;
  return `(${ddd}) ${number.slice(0, split)}-${number.slice(split)}`;
}
