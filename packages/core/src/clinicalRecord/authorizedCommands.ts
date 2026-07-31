import {
  assertStaffAuthorized,
  type StaffAccessContext,
} from '../identity';
import type { ClinicalSessionRepository } from '../clinicalSession';
import {
  approveClinicalRecordRevision,
  createClinicalRecordDraft,
  type ApproveClinicalRecordInput,
  type CreateClinicalRecordDraftInput,
} from './aggregate';
import {
  createClinicalRecordAmendment,
  type CreateClinicalRecordAmendmentInput,
} from './amendment';
import type { ClinicalRecordCommandMetadata } from './eventFactory';
import type { ClinicalRecordRepository } from './ports';
import type {
  ClinicalRecord,
  ClinicalRecordTransitionResult,
} from './types';

export interface ClinicalRecordDependencies {
  records: ClinicalRecordRepository;
  sessions: ClinicalSessionRepository;
}

export interface PersistedClinicalRecordCommandMetadata
  extends ClinicalRecordCommandMetadata {
  commandId: string;
}

export interface ClinicalRecordCommandResult {
  record: ClinicalRecord;
  idempotentReplay: boolean;
}

async function executeRecordCommand(
  dependencies: ClinicalRecordDependencies,
  actor: StaffAccessContext,
  recordId: string,
  metadata: PersistedClinicalRecordCommandMetadata,
  transition: (record: ClinicalRecord) => ClinicalRecordTransitionResult
): Promise<ClinicalRecordCommandResult> {
  const replay = await dependencies.records.findByCommandId(
    actor.organizationId,
    metadata.commandId
  );
  if (replay) return { record: replay, idempotentReplay: true };
  const current = await dependencies.records.getById(
    actor.organizationId,
    recordId
  );
  if (!current) throw new Error('Prontuário não encontrado na organização.');
  assertStaffAuthorized(actor, 'clinical_records.write', {
    organizationId: current.organizationId,
    patientId: current.patientId,
    assignedProfessionalIds: current.assignedProfessionalIds,
  });
  const result = transition(current);
  await dependencies.records.commit({
    record: result.record,
    expectedVersion: current.version,
    commandId: metadata.commandId,
    events: result.events,
  });
  return { record: result.record, idempotentReplay: false };
}

export async function createClinicalRecordDraftCommand(
  dependencies: ClinicalRecordDependencies,
  actor: StaffAccessContext,
  input: CreateClinicalRecordDraftInput,
  metadata: PersistedClinicalRecordCommandMetadata
): Promise<ClinicalRecordCommandResult> {
  if (actor.organizationId !== input.organizationId) {
    throw new Error('Acesso negado: cross_tenant.');
  }
  const replay = await dependencies.records.findByCommandId(
    actor.organizationId,
    metadata.commandId
  );
  if (replay) return { record: replay, idempotentReplay: true };
  const existing = await dependencies.records.findBySessionId(
    input.organizationId,
    input.sessionId
  );
  if (existing) throw new Error('A sessão já possui prontuário.');
  const session = await dependencies.sessions.getById(
    input.organizationId,
    input.sessionId
  );
  if (!session) throw new Error('Sessão clínica não encontrada.');
  if (
    session.patientId !== input.patientId ||
    session.primaryProfessionalId !== input.responsibleProfessionalId
  ) {
    throw new Error('Os vínculos do prontuário não correspondem à sessão.');
  }
  if (
    !['awaiting_processing', 'processing_failed', 'awaiting_review'].includes(
      session.status
    )
  ) {
    throw new Error('A sessão não está disponível para documentação.');
  }
  if (
    input.source === 'ai_assisted' &&
    input.aiProvenance?.transcriptionId !== session.artifacts.transcription?.id
  ) {
    throw new Error('A proveniência não corresponde à transcrição da sessão.');
  }
  assertStaffAuthorized(actor, 'clinical_records.write', {
    organizationId: session.organizationId,
    patientId: session.patientId,
    assignedProfessionalIds: session.assignedProfessionalIds,
  });
  const result = createClinicalRecordDraft(
    {
      ...input,
      assignedProfessionalIds: session.assignedProfessionalIds,
    },
    metadata
  );
  await dependencies.records.commit({
    record: result.record,
    expectedVersion: 0,
    commandId: metadata.commandId,
    events: result.events,
  });
  return { record: result.record, idempotentReplay: false };
}

export function approveClinicalRecordRevisionCommand(
  dependencies: ClinicalRecordDependencies,
  actor: StaffAccessContext,
  recordId: string,
  input: ApproveClinicalRecordInput,
  metadata: PersistedClinicalRecordCommandMetadata
): Promise<ClinicalRecordCommandResult> {
  if (actor.professionalProfileId !== input.professionalId) {
    throw new Error('O usuário não representa o profissional aprovador.');
  }
  return executeRecordCommand(
    dependencies,
    actor,
    recordId,
    metadata,
    (record) => {
      assertStaffAuthorized(actor, 'clinical_records.approve', {
        organizationId: record.organizationId,
        patientId: record.patientId,
        assignedProfessionalIds: record.assignedProfessionalIds,
      });
      return approveClinicalRecordRevision(record, input, metadata);
    }
  );
}

export function createClinicalRecordAmendmentCommand(
  dependencies: ClinicalRecordDependencies,
  actor: StaffAccessContext,
  recordId: string,
  input: CreateClinicalRecordAmendmentInput,
  metadata: PersistedClinicalRecordCommandMetadata
): Promise<ClinicalRecordCommandResult> {
  return executeRecordCommand(
    dependencies,
    actor,
    recordId,
    metadata,
    (record) => createClinicalRecordAmendment(record, input, metadata)
  );
}
