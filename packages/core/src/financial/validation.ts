import type { MoneyCents } from './types';

export function assertId(value: string, field: string): void {
  if (!value.trim()) throw new Error(`${field} é obrigatório.`);
}

export function assertIsoDate(value: string, field: string): void {
  if (Number.isNaN(Date.parse(value))) {
    throw new Error(`${field} deve ser uma data ISO válida.`);
  }
}

export function assertMoney(
  value: MoneyCents,
  field: string,
  allowZero = false
): void {
  const minimum = allowZero ? 0 : 1;
  if (!Number.isSafeInteger(value) || value < minimum) {
    throw new Error(`${field} deve ser informado em centavos inteiros.`);
  }
}

export function sumMoney(values: readonly MoneyCents[]): MoneyCents {
  return values.reduce((total, value) => total + value, 0);
}
