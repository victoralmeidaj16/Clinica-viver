export const BRAZIL_UFS = [
  'AC', 'AL', 'AP', 'AM', 'BA', 'CE', 'DF', 'ES', 'GO', 'MA', 'MT', 'MS', 'MG',
  'PA', 'PB', 'PR', 'PE', 'PI', 'RJ', 'RN', 'RS', 'RO', 'RR', 'SC', 'SP', 'SE', 'TO',
] as const;

const BRAZIL_UF_SET = new Set<string>(BRAZIL_UFS);

export function isBrazilUf(value: unknown): boolean {
  return typeof value === 'string' && BRAZIL_UF_SET.has(value.trim().toUpperCase());
}
