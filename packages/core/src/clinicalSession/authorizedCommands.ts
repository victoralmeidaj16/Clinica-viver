import type { IdentityRepository } from '../identity';
import {
  assertStaffAuthorized,
  type OrganizationPermission,
  type StaffAccessContext,
} from '../identity';
import type { FinancialCharge } from '../financial';
import type { PatientHandoff } from '../patientHandoff';
import {
  approveClinicalRecord,
  linkDeliveredPatientHandoff,
} from './postSession';
import {
  completeClinicalSession,
  linkSessionCharge,
  markSessionNotificationSent,
  markSessionReceiptIssued,
} from './automationCompletion';
import { markSessionAutomationFailed } from './automationRecovery';
import {
  attachSessionRecording,
  confirmClinicalSession,
  endClinicalSession,
  recordSessionConsent,
  scheduleClinicalSession,
  startClinicalSession,
  type ScheduleClinicalSessionInput,
} from './lifecycle';
import type { TransitionMetadata } from './eventFactory';
import type { ClinicalSessionRepository } from './ports';
import type {
  AutomationStepName,
  ClinicalSession,
  RecordingReference,
  SessionConsentRecord,
  SessionTransitionResult,
} from './types';

export interface ClinicalSessionDependencies {
  sessions: ClinicalSessionRepository;
  identities: IdentityRepository;
}

export interface SessionCommandMetadata extends TransitionMetadata {
  commandId: string;
}

export interface SessionCommandResult {
  session: ClinicalSession;
  idempotentReplay: boolean;
}

async function executeAuthorizedCommand(
  dependencies: ClinicalSessionDependencies,
  actor: StaffAccessContext,
  sessionId: string,
  permission: OrganizationPermission,
  metadata: SessionCommandMetadata,
  transition: (session: ClinicalSession) => SessionTransitionResult
): Promise<SessionCommandResult> {
  const replay = await dependencies.sessions.findByCommandId(
    actor.organizationId,
    metadata.commandId
  );
  if (replay) return { session: replay, idempotentReplay: true };

  const current = await dependencies.sessions.getById(
    actor.organizationId,
    sessionId
  );
  if (!current) throw new Error('Sessão clínica não encontrada na organização.');
  assertStaffAuthorized(actor, permission, {
    organizationId: current.organizationId,
    patientId: current.patientId,
    assignedProfessionalIds: current.assignedProfessionalIds,
  });
  const result = transition(current);
  await dependencies.sessions.commit({
    session: result.session,
    expectedVersion: current.version,
    commandId: metadata.commandId,
    events: result.events,
  });
  return { session: result.session, idempotentReplay: false };
}

export async function scheduleClinicalSessionCommand(
  dependencies: ClinicalSessionDependencies,
  actor: StaffAccessContext,
  input: ScheduleClinicalSessionInput,
  metadata: SessionCommandMetadata
): Promise<SessionCommandResult> {
  const replay = await dependencies.sessions.findByCommandId(
    actor.organizationId,
    metadata.commandId
  );
  if (replay) return { session: replay, idempotentReplay: true };

  const patient = await dependencies.identities.getPatient(
    input.organizationId,
    input.patientId
  );
  if (!patient) throw new Error('Paciente não encontrado na organização.');
  assertStaffAuthorized(actor, 'schedule.write', {
    organizationId: input.organizationId,
    patientId: patient.id,
    assignedProfessionalIds: patient.assignedProfessionalIds,
  });
  const hasInvalidProfessional = input.assignedProfessionalIds.some(
    (id) => !patient.assignedProfessionalIds.includes(id)
  );
  if (hasInvalidProfessional) {
    throw new Error('A sessão contém profissional não atribuído ao paciente.');
  }

  const result = scheduleClinicalSession(input, metadata);
  await dependencies.sessions.commit({
    session: result.session,
    expectedVersion: 0,
    commandId: metadata.commandId,
    events: result.events,
  });
  return { session: result.session, idempotentReplay: false };
}

export function confirmClinicalSessionCommand(
  dependencies: ClinicalSessionDependencies,
  actor: StaffAccessContext,
  sessionId: string,
  metadata: SessionCommandMetadata
): Promise<SessionCommandResult> {
  return executeAuthorizedCommand(
    dependencies,
    actor,
    sessionId,
    'schedule.write',
    metadata,
    (session) => confirmClinicalSession(session, metadata)
  );
}

export function startClinicalSessionCommand(
  dependencies: ClinicalSessionDependencies,
  actor: StaffAccessContext,
  sessionId: string,
  metadata: SessionCommandMetadata
): Promise<SessionCommandResult> {
  return executeAuthorizedCommand(
    dependencies,
    actor,
    sessionId,
    'clinical_sessions.write',
    metadata,
    (session) => startClinicalSession(session, metadata)
  );
}

export function recordSessionConsentCommand(
  dependencies: ClinicalSessionDependencies,
  actor: StaffAccessContext,
  sessionId: string,
  consent: SessionConsentRecord,
  metadata: SessionCommandMetadata
): Promise<SessionCommandResult> {
  return executeAuthorizedCommand(
    dependencies,
    actor,
    sessionId,
    'clinical_sessions.write',
    metadata,
    (session) => recordSessionConsent(session, consent, metadata)
  );
}

export function attachSessionRecordingCommand(
  dependencies: ClinicalSessionDependencies,
  actor: StaffAccessContext,
  sessionId: string,
  recording: RecordingReference,
  metadata: SessionCommandMetadata
): Promise<SessionCommandResult> {
  return executeAuthorizedCommand(
    dependencies,
    actor,
    sessionId,
    'clinical_sessions.write',
    metadata,
    (session) => attachSessionRecording(session, recording, metadata)
  );
}

export function endClinicalSessionCommand(
  dependencies: ClinicalSessionDependencies,
  actor: StaffAccessContext,
  sessionId: string,
  metadata: SessionCommandMetadata
): Promise<SessionCommandResult> {
  return executeAuthorizedCommand(
    dependencies,
    actor,
    sessionId,
    'clinical_sessions.write',
    metadata,
    (session) => endClinicalSession(session, metadata)
  );
}

export function approveClinicalRecordCommand(
  dependencies: ClinicalSessionDependencies,
  actor: StaffAccessContext,
  sessionId: string,
  approvedClinicalRecordId: string,
  metadata: SessionCommandMetadata
): Promise<SessionCommandResult> {
  return executeAuthorizedCommand(
    dependencies,
    actor,
    sessionId,
    'clinical_records.approve',
    metadata,
    (session) =>
      approveClinicalRecord(session, approvedClinicalRecordId, metadata)
  );
}

export function linkDeliveredPatientHandoffCommand(
  dependencies: ClinicalSessionDependencies,
  actor: StaffAccessContext,
  sessionId: string,
  handoff: PatientHandoff,
  metadata: SessionCommandMetadata
): Promise<SessionCommandResult> {
  return executeAuthorizedCommand(
    dependencies,
    actor,
    sessionId,
    'clinical_sessions.write',
    metadata,
    (session) => linkDeliveredPatientHandoff(session, handoff, metadata)
  );
}

export function linkSessionChargeCommand(
  dependencies: ClinicalSessionDependencies,
  actor: StaffAccessContext,
  sessionId: string,
  charge: FinancialCharge,
  metadata: SessionCommandMetadata
): Promise<SessionCommandResult> {
  return executeAuthorizedCommand(
    dependencies,
    actor,
    sessionId,
    'billing.write',
    metadata,
    (session) => linkSessionCharge(session, charge, metadata)
  );
}

export function markSessionReceiptIssuedCommand(
  dependencies: ClinicalSessionDependencies,
  actor: StaffAccessContext,
  sessionId: string,
  receiptId: string,
  metadata: SessionCommandMetadata
): Promise<SessionCommandResult> {
  return executeAuthorizedCommand(
    dependencies,
    actor,
    sessionId,
    'billing.write',
    metadata,
    (session) => markSessionReceiptIssued(session, receiptId, metadata)
  );
}

export function markSessionNotificationSentCommand(
  dependencies: ClinicalSessionDependencies,
  actor: StaffAccessContext,
  sessionId: string,
  notificationReference: string,
  metadata: SessionCommandMetadata
): Promise<SessionCommandResult> {
  return executeAuthorizedCommand(
    dependencies,
    actor,
    sessionId,
    'clinical_sessions.write',
    metadata,
    (session) =>
      markSessionNotificationSent(session, notificationReference, metadata)
  );
}

export function markSessionAutomationFailedCommand(
  dependencies: ClinicalSessionDependencies,
  actor: StaffAccessContext,
  sessionId: string,
  step: AutomationStepName,
  errorCode: string,
  metadata: SessionCommandMetadata
): Promise<SessionCommandResult> {
  return executeAuthorizedCommand(
    dependencies,
    actor,
    sessionId,
    'clinical_sessions.write',
    metadata,
    (session) =>
      markSessionAutomationFailed(session, step, errorCode, metadata)
  );
}

export function completeClinicalSessionCommand(
  dependencies: ClinicalSessionDependencies,
  actor: StaffAccessContext,
  sessionId: string,
  metadata: SessionCommandMetadata
): Promise<SessionCommandResult> {
  return executeAuthorizedCommand(
    dependencies,
    actor,
    sessionId,
    'clinical_sessions.write',
    metadata,
    (session) => completeClinicalSession(session, metadata)
  );
}
