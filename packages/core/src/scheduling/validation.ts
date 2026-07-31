export function requireSchedulingText(value: string, field: string): string {
  const normalized = value.replace(/\s+/g, ' ').trim();
  if (!normalized) throw new Error(`${field} é obrigatório.`);
  return normalized;
}

export function requireSchedulingIsoDate(value: string, field: string): string {
  if (Number.isNaN(Date.parse(value))) {
    throw new Error(`${field} deve ser uma data ISO válida.`);
  }
  return value;
}

export function validateTimeRange(
  startsAt: string,
  endsAt: string,
  label = 'horário'
): void {
  if (Date.parse(endsAt) <= Date.parse(startsAt)) {
    throw new Error(`O fim do ${label} deve ser posterior ao início.`);
  }
}
