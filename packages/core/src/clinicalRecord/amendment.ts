import {
  createClinicalRecordEvent,
  evolveClinicalRecord,
  type ClinicalRecordCommandMetadata,
} from './eventFactory';
import type {
  ClinicalRecord,
  ClinicalRecordTransitionResult,
  SoapClinicalContent,
} from './types';
import {
  normalizeSoapContent,
  requireRecordIsoDate,
  requireRecordText,
} from './validation';

export interface CreateClinicalRecordAmendmentInput {
  revisionId: string;
  reason: string;
  content: SoapClinicalContent;
  createdAt: string;
}

export function createClinicalRecordAmendment(
  record: ClinicalRecord,
  input: CreateClinicalRecordAmendmentInput,
  metadata: ClinicalRecordCommandMetadata
): ClinicalRecordTransitionResult {
  if (record.status !== 'approved' || !record.currentApprovedRevisionNumber) {
    throw new Error('Somente um prontuário aprovado pode ser retificado.');
  }
  if (record.activeDraftRevisionNumber) {
    throw new Error('Já existe uma retificação em rascunho.');
  }
  if (record.revisions.some((item) => item.id === input.revisionId)) {
    throw new Error('revisionId já utilizado neste prontuário.');
  }
  const createdAt = requireRecordIsoDate(input.createdAt, 'createdAt');
  if (
    Date.parse(createdAt) < Date.parse(record.updatedAt) ||
    Date.parse(metadata.occurredAt) < Date.parse(createdAt)
  ) {
    throw new Error('A data da retificação é inconsistente.');
  }
  const revisionNumber =
    Math.max(...record.revisions.map((item) => item.revisionNumber)) + 1;
  const next = evolveClinicalRecord(
    record,
    {
      status: 'amendment_draft',
      activeDraftRevisionNumber: revisionNumber,
      revisions: [
        ...record.revisions,
        {
          id: requireRecordText(input.revisionId, 'revisionId'),
          revisionNumber,
          kind: 'amendment',
          source: 'manual',
          content: normalizeSoapContent(input.content),
          amendmentReason: requireRecordText(input.reason, 'reason'),
          createdByUserId: requireRecordText(
            metadata.actorUserId,
            'actorUserId'
          ),
          createdAt,
        },
      ],
    },
    metadata.occurredAt
  );
  return {
    record: next,
    events: [
      createClinicalRecordEvent(
        next,
        'clinical_record.amendment_created',
        metadata,
        { revisionNumber }
      ),
    ],
  };
}

export function setClinicalRecordLegalHold(
  record: ClinicalRecord,
  enabled: boolean,
  reasonCode: string,
  metadata: ClinicalRecordCommandMetadata
): ClinicalRecordTransitionResult {
  if (record.legalHold === enabled) {
    throw new Error('A retenção legal já está no estado informado.');
  }
  const next = evolveClinicalRecord(
    record,
    { legalHold: enabled },
    metadata.occurredAt
  );
  return {
    record: next,
    events: [
      createClinicalRecordEvent(
        next,
        'clinical_record.legal_hold_changed',
        metadata,
        {
          enabled,
          reasonCode: requireRecordText(reasonCode, 'reasonCode'),
        }
      ),
    ],
  };
}
