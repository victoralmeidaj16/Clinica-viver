import {
  createClinicalRecordEvent,
  evolveClinicalRecord,
  type ClinicalRecordCommandMetadata,
} from './eventFactory';
import type {
  AiDraftProvenance,
  ClinicalRecord,
  ClinicalRecordApproval,
  ClinicalRecordRevision,
  ClinicalRecordTransitionResult,
  SoapClinicalContent,
} from './types';
import {
  normalizeSoapContent,
  requireRecordIsoDate,
  requireRecordText,
  validateAiProvenance,
} from './validation';

export interface CreateClinicalRecordDraftInput {
  id: string;
  revisionId: string;
  organizationId: string;
  patientId: string;
  sessionId: string;
  responsibleProfessionalId: string;
  assignedProfessionalIds: readonly string[];
  source: ClinicalRecordRevision['source'];
  content: SoapClinicalContent;
  aiProvenance?: AiDraftProvenance;
  retentionUntil: string;
  createdAt: string;
}

function validateSource(
  source: ClinicalRecordRevision['source'],
  provenance?: AiDraftProvenance
): AiDraftProvenance | undefined {
  if (source === 'ai_assisted' && !provenance) {
    throw new Error('Rascunhos assistidos por IA exigem proveniência.');
  }
  if (source === 'manual' && provenance) {
    throw new Error('Rascunhos manuais não devem declarar proveniência de IA.');
  }
  return provenance ? validateAiProvenance(provenance) : undefined;
}

export function createClinicalRecordDraft(
  input: CreateClinicalRecordDraftInput,
  metadata: ClinicalRecordCommandMetadata
): ClinicalRecordTransitionResult {
  const createdAt = requireRecordIsoDate(input.createdAt, 'createdAt');
  if (Date.parse(metadata.occurredAt) < Date.parse(createdAt)) {
    throw new Error('O evento não pode anteceder a criação do prontuário.');
  }
  const assignedProfessionalIds = Array.from(
    new Set(
      input.assignedProfessionalIds.map((id) =>
        requireRecordText(id, 'assignedProfessionalId')
      )
    )
  );
  const responsibleProfessionalId = requireRecordText(
    input.responsibleProfessionalId,
    'responsibleProfessionalId'
  );
  if (!assignedProfessionalIds.includes(responsibleProfessionalId)) {
    throw new Error('O profissional responsável deve estar atribuído.');
  }
  const revision: ClinicalRecordRevision = {
    id: requireRecordText(input.revisionId, 'revisionId'),
    revisionNumber: 1,
    kind: 'initial',
    source: input.source,
    content: normalizeSoapContent(input.content),
    aiProvenance: validateSource(input.source, input.aiProvenance),
    createdByUserId: requireRecordText(
      metadata.actorUserId,
      'actorUserId'
    ),
    createdAt,
  };
  if (
    revision.aiProvenance &&
    Date.parse(revision.aiProvenance.generatedAt) > Date.parse(createdAt)
  ) {
    throw new Error('A geração por IA não pode ocorrer após o rascunho.');
  }
  const retentionUntil = requireRecordIsoDate(
    input.retentionUntil,
    'retentionUntil'
  );
  if (Date.parse(retentionUntil) <= Date.parse(createdAt)) {
    throw new Error('A retenção deve ser posterior à criação.');
  }
  const record: ClinicalRecord = {
    schemaVersion: 1,
    id: requireRecordText(input.id, 'id'),
    organizationId: requireRecordText(
      input.organizationId,
      'organizationId'
    ),
    patientId: requireRecordText(input.patientId, 'patientId'),
    sessionId: requireRecordText(input.sessionId, 'sessionId'),
    responsibleProfessionalId,
    assignedProfessionalIds,
    status: 'draft',
    revisions: [revision],
    approvals: [],
    activeDraftRevisionNumber: 1,
    retentionUntil,
    legalHold: false,
    version: 1,
    createdAt,
    updatedAt: createdAt,
  };
  return {
    record,
    events: [
      createClinicalRecordEvent(
        record,
        'clinical_record.draft_created',
        metadata,
        { revisionNumber: 1, source: input.source }
      ),
    ],
  };
}

export interface ApproveClinicalRecordInput {
  professionalId: string;
  contentHashSha256: string;
  approvalId: string;
}

export function approveClinicalRecordRevision(
  record: ClinicalRecord,
  input: ApproveClinicalRecordInput,
  metadata: ClinicalRecordCommandMetadata
): ClinicalRecordTransitionResult {
  if (!record.activeDraftRevisionNumber) {
    throw new Error('Não há revisão em rascunho para aprovar.');
  }
  const professionalId = requireRecordText(
    input.professionalId,
    'professionalId'
  );
  if (!record.assignedProfessionalIds.includes(professionalId)) {
    throw new Error('O aprovador deve ser profissional atribuído ao paciente.');
  }
  const revisionNumber = record.activeDraftRevisionNumber;
  if (record.approvals.some((item) => item.id === input.approvalId)) {
    throw new Error('approvalId já utilizado neste prontuário.');
  }
  const contentHashSha256 = requireRecordText(
    input.contentHashSha256,
    'contentHashSha256'
  ).toLocaleLowerCase('en-US');
  if (!/^[a-f0-9]{64}$/.test(contentHashSha256)) {
    throw new Error('contentHashSha256 deve possuir 64 caracteres hexadecimais.');
  }
  const approval: ClinicalRecordApproval = {
    id: requireRecordText(input.approvalId, 'approvalId'),
    revisionNumber,
    professionalId,
    approvedByUserId: requireRecordText(
      metadata.actorUserId,
      'actorUserId'
    ),
    approvedAt: requireRecordIsoDate(metadata.occurredAt, 'approvedAt'),
    contentHashSha256,
    attestation: 'reviewed_and_approved_by_professional',
  };
  const isAmendment = revisionNumber > 1;
  const next = evolveClinicalRecord(
    record,
    {
      status: 'approved',
      approvals: [...record.approvals, approval],
      activeDraftRevisionNumber: undefined,
      currentApprovedRevisionNumber: revisionNumber,
    },
    metadata.occurredAt
  );
  return {
    record: next,
    events: [
      createClinicalRecordEvent(
        next,
        isAmendment
          ? 'clinical_record.amendment_approved'
          : 'clinical_record.approved',
        metadata,
        { revisionNumber }
      ),
    ],
  };
}
