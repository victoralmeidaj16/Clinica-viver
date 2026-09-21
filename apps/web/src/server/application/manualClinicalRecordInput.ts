export interface ManualClinicalRecordInput {
  patientId: string;
  title: string;
  subjective: string;
  objective: string;
  assessment: string;
  plan: string;
}

export const MANUAL_SOAP_FIELDS = [
  ['subjective', 'Subjetivo'],
  ['objective', 'Objetivo'],
  ['assessment', 'Avaliação'],
  ['plan', 'Plano'],
] as const;

function text(value: unknown): string {
  return typeof value === 'string' ? value.trim() : '';
}

export function parseManualClinicalRecordInput(
  body: Record<string, unknown>
): ManualClinicalRecordInput {
  const input = {
    patientId: text(body.patientId),
    title: text(body.title),
    subjective: text(body.subjective),
    objective: text(body.objective),
    assessment: text(body.assessment),
    plan: text(body.plan),
  };
  if (!input.patientId || !input.title) {
    throw new Error('Paciente e título são obrigatórios.');
  }
  if (!MANUAL_SOAP_FIELDS.some(([field]) => input[field])) {
    throw new Error('Preencha ao menos uma anotação clínica.');
  }
  if (input.title.length > 200) {
    throw new Error('O título deve ter no máximo 200 caracteres.');
  }
  for (const [field, label] of MANUAL_SOAP_FIELDS) {
    if (input[field].length > 2_000) {
      throw new Error(`${label} deve ter no máximo 2000 caracteres.`);
    }
  }
  return input;
}
