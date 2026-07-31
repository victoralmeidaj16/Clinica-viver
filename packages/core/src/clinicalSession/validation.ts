export function requireText(value: string, field: string): string {
  const normalized = value.replace(/\s+/g, ' ').trim();
  if (!normalized) throw new Error(`${field} é obrigatório.`);
  return normalized;
}

export function requireIsoDate(value: string, field: string): string {
  if (Number.isNaN(Date.parse(value))) {
    throw new Error(`${field} deve ser uma data ISO válida.`);
  }
  return value;
}

export function requireStatus(
  actual: string,
  expected: readonly string[],
  action: string
): void {
  if (!expected.includes(actual)) {
    throw new Error(
      `${action} não é permitido quando a sessão está em ${actual}.`
    );
  }
}
