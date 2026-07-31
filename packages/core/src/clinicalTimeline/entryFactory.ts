import type {
  ClinicalTimelineEntry,
  TimelineEvidenceReference,
} from './types';

function required(value: string, field: string): string {
  const normalized = value.trim();
  if (!normalized) throw new Error(`${field} é obrigatório.`);
  return normalized;
}

function iso(value: string, field: string): string {
  if (Number.isNaN(Date.parse(value))) {
    throw new Error(`${field} deve ser uma data ISO válida.`);
  }
  return value;
}

function evidenceReference(
  evidence: TimelineEvidenceReference
): TimelineEvidenceReference {
  const hash = evidence.contentHashSha256?.toLowerCase();
  if (hash && !/^[a-f0-9]{64}$/.test(hash)) {
    throw new Error('contentHashSha256 deve possuir 64 caracteres hexadecimais.');
  }
  return {
    sourceType: evidence.sourceType,
    sourceId: required(evidence.sourceId, 'evidence.sourceId'),
    sourceVersion: evidence.sourceVersion,
    sourceRevisionId: evidence.sourceRevisionId
      ? required(evidence.sourceRevisionId, 'evidence.sourceRevisionId')
      : undefined,
    sourceField: evidence.sourceField
      ? required(evidence.sourceField, 'evidence.sourceField')
      : undefined,
    contentHashSha256: hash,
  };
}

export function createClinicalTimelineEntry(
  input: Omit<ClinicalTimelineEntry, 'schemaVersion'>
): ClinicalTimelineEntry {
  const professionalIds = Array.from(
    new Set(
      input.authorizedProfessionalIds.map((id) =>
        required(id, 'authorizedProfessionalId')
      )
    )
  );
  if (professionalIds.length === 0) {
    throw new Error('A entrada deve possuir ao menos um profissional autorizado.');
  }
  const summary = required(input.summary, 'summary');
  if (summary.length > 500) {
    throw new Error('summary deve ter no máximo 500 caracteres.');
  }
  const evidenceExcerpt = input.evidenceExcerpt?.trim();
  if (evidenceExcerpt && evidenceExcerpt.length > 2_000) {
    throw new Error('evidenceExcerpt deve ter no máximo 2000 caracteres.');
  }

  return {
    schemaVersion: 1,
    id: required(input.id, 'id'),
    organizationId: required(input.organizationId, 'organizationId'),
    patientId: required(input.patientId, 'patientId'),
    authorizedProfessionalIds: professionalIds,
    category: input.category,
    importance: input.importance,
    occurredAt: iso(input.occurredAt, 'occurredAt'),
    recordedAt: iso(input.recordedAt, 'recordedAt'),
    title: required(input.title, 'title'),
    summary,
    evidenceExcerpt: evidenceExcerpt || undefined,
    tags: Array.from(
      new Set(
        input.tags
          .map((tag) => tag.trim().toLocaleLowerCase('pt-BR'))
          .filter(Boolean)
      )
    ),
    evidence: evidenceReference(input.evidence),
  };
}

export function timelineEntryId(
  sourceType: TimelineEvidenceReference['sourceType'],
  sourceId: string,
  discriminator: string
): string {
  return `timeline:${sourceType}:${sourceId}:${discriminator}`;
}
