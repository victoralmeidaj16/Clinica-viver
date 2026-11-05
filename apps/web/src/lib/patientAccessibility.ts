export interface PatientAccessibility {
  necessita: boolean;
  descricao?: string;
}

export function validatePatientAccessibility(value: unknown):
  | { ok: true; data: PatientAccessibility | null | undefined }
  | { ok: false; error: string } {
  if (value === undefined || value === null) return { ok: true, data: value };
  if (typeof value !== 'object' || Array.isArray(value) || !('necessita' in value) || typeof value.necessita !== 'boolean') {
    return { ok: false, error: 'Informe se o paciente possui deficiência ou necessidade de acessibilidade.' };
  }
  const descricao = 'descricao' in value ? value.descricao : undefined;
  if (descricao !== undefined && (typeof descricao !== 'string' || descricao.length > 1000)) {
    return { ok: false, error: 'Descreva a adaptação necessária em até 1.000 caracteres.' };
  }
  return { ok: true, data: { necessita: value.necessita,
    ...(value.necessita && typeof descricao === 'string' && descricao.trim() ? { descricao: descricao.trim() } : {}),
  } };
}

export function readPatientAccessibility(value: unknown): PatientAccessibility | null {
  const parsed = typeof value === 'string' ? JSON.parse(value) : value;
  const result = validatePatientAccessibility(parsed);
  return result.ok ? result.data ?? null : null;
}
