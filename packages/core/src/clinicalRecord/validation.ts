import type { AiDraftProvenance, SoapClinicalContent } from './types';

export function requireRecordText(value: string, field: string): string {
  const normalized = value.replace(/\s+/g, ' ').trim();
  if (!normalized) throw new Error(`${field} é obrigatório.`);
  return normalized;
}

function requireClinicalText(value: string, field: string): string {
  const normalized = value.trim();
  if (!normalized) throw new Error(`${field} é obrigatório.`);
  return normalized;
}

export function requireRecordIsoDate(value: string, field: string): string {
  if (Number.isNaN(Date.parse(value))) {
    throw new Error(`${field} deve ser uma data ISO válida.`);
  }
  return value;
}

export function normalizeSoapContent(
  content: SoapClinicalContent
): SoapClinicalContent {
  return {
    subjective: requireClinicalText(content.subjective, 'subjective'),
    objective: requireClinicalText(content.objective, 'objective'),
    assessment: requireClinicalText(content.assessment, 'assessment'),
    plan: requireClinicalText(content.plan, 'plan'),
    extractedTasks: Array.from(
      new Set(
        content.extractedTasks
          .map((task) => requireRecordText(task, 'extractedTask'))
      )
    ),
  };
}

export function validateAiProvenance(
  provenance: AiDraftProvenance
): AiDraftProvenance {
  return {
    provider: requireRecordText(provenance.provider, 'provider'),
    model: requireRecordText(provenance.model, 'model'),
    promptVersion: requireRecordText(
      provenance.promptVersion,
      'promptVersion'
    ),
    transcriptionId: requireRecordText(
      provenance.transcriptionId,
      'transcriptionId'
    ),
    generatedAt: requireRecordIsoDate(
      provenance.generatedAt,
      'generatedAt'
    ),
  };
}
