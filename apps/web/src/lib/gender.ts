export const GENDER_VALUES = ['MASCULINO', 'FEMININO', 'OUTRO'] as const;
export type GenderValue = (typeof GENDER_VALUES)[number];

export function normalizeGender(value: unknown): GenderValue | null {
  const normalized = String(value ?? '').trim().toUpperCase();
  return GENDER_VALUES.includes(normalized as GenderValue) ? normalized as GenderValue : null;
}

export function validateGender(value: unknown, other: unknown): { gender: GenderValue; other?: string } | null {
  const gender = normalizeGender(value);
  if (!gender) return null;
  if (gender !== 'OUTRO') return { gender };

  const description = String(other ?? '').trim();
  if (!description || description.length > 120) return null;
  return { gender, other: description };
}

export function formatGender(value: string | undefined, other?: string): string | undefined {
  if (value === 'MASCULINO') return 'Masculino';
  if (value === 'FEMININO') return 'Feminino';
  if (value === 'OUTRO') return other ? `Outro — ${other}` : 'Outro';
  return value;
}
