const TOPICS_MAX_LENGTH = 1_000;

export function requiredText(value: string, field: string): string {
  const normalized = value.trim();
  if (!normalized) throw new Error(`${field} é obrigatório.`);
  return normalized;
}

export function isoDate(value: string, field: string): string {
  if (Number.isNaN(Date.parse(value))) {
    throw new Error(`${field} deve ser uma data ISO válida.`);
  }
  return value;
}

export function optionalTopics(value?: string): string | undefined {
  if (value === undefined) return undefined;
  const normalized = value.trim();
  if (!normalized) return undefined;
  if (normalized.length > TOPICS_MAX_LENGTH) {
    throw new Error(`topicsToDiscuss deve ter no máximo ${TOPICS_MAX_LENGTH} caracteres.`);
  }
  return normalized;
}

export function assertMoodLevel(
  value?: number
): asserts value is 1 | 2 | 3 | 4 | 5 | undefined {
  if (
    value !== undefined &&
    (!Number.isInteger(value) || value < 1 || value > 5)
  ) {
    throw new Error('moodLevel deve estar entre 1 e 5.');
  }
}

export function assertWithinWindow(
  occurredAt: string,
  availableFrom: string,
  expiresAt: string
): void {
  const occurred = Date.parse(isoDate(occurredAt, 'occurredAt'));
  if (occurred < Date.parse(availableFrom)) {
    throw new Error('O check-in pré-sessão ainda não está disponível.');
  }
  if (occurred >= Date.parse(expiresAt)) {
    throw new Error('O check-in pré-sessão expirou.');
  }
}
