import {
  authorizeStaff,
  type StaffAccessContext,
} from '../identity';
import type {
  ClinicalRecordAccessAuditPort,
  ClinicalRecordFilter,
  ClinicalRecordRepository,
} from './ports';
import type { ClinicalRecord } from './types';
import {
  requireRecordIsoDate,
  requireRecordText,
} from './validation';

export interface ClinicalRecordQueryDependencies {
  records: ClinicalRecordRepository;
  accessAudit: ClinicalRecordAccessAuditPort;
}

export interface ClinicalRecordQueryMetadata {
  occurredAt: string;
  correlationId: string;
}

function auditId(
  metadata: ClinicalRecordQueryMetadata,
  action: string
): string {
  return `${requireRecordText(metadata.correlationId, 'correlationId')}:${action}`;
}

export async function getClinicalRecordForStaff(
  dependencies: ClinicalRecordQueryDependencies,
  actor: StaffAccessContext,
  recordId: string,
  metadata: ClinicalRecordQueryMetadata
): Promise<ClinicalRecord> {
  const occurredAt = requireRecordIsoDate(metadata.occurredAt, 'occurredAt');
  const record = await dependencies.records.getById(
    actor.organizationId,
    recordId
  );
  const decision = record
    ? authorizeStaff(actor, 'clinical_records.read', {
        organizationId: record.organizationId,
        patientId: record.patientId,
        assignedProfessionalIds: record.assignedProfessionalIds,
      })
    : { allowed: false as const, reason: 'not_found' };
  if (!record || !decision.allowed) {
    await dependencies.accessAudit.append({
      id: auditId(metadata, 'access_denied'),
      organizationId: actor.organizationId,
      actorUserId: actor.userId,
      action: 'clinical_record.access_denied',
      recordId,
      occurredAt,
      correlationId: metadata.correlationId,
      reason: decision.reason,
    });
    throw new Error(
      record
        ? `Acesso negado: ${decision.reason}.`
        : 'Prontuário não encontrado na organização.'
    );
  }
  await dependencies.accessAudit.append({
    id: auditId(metadata, 'read'),
    organizationId: actor.organizationId,
    actorUserId: actor.userId,
    action: 'clinical_record.read',
    recordId,
    occurredAt,
    correlationId: metadata.correlationId,
  });
  return record;
}

export async function listClinicalRecordsForStaff(
  dependencies: ClinicalRecordQueryDependencies,
  actor: StaffAccessContext,
  filter: Omit<ClinicalRecordFilter, 'organizationId'>,
  metadata: ClinicalRecordQueryMetadata
): Promise<readonly ClinicalRecord[]> {
  const occurredAt = requireRecordIsoDate(metadata.occurredAt, 'occurredAt');
  const organizationDecision = authorizeStaff(actor, 'clinical_records.read', {
    organizationId: actor.organizationId,
  });
  if (!organizationDecision.allowed) {
    await dependencies.accessAudit.append({
      id: auditId(metadata, 'access_denied'),
      organizationId: actor.organizationId,
      actorUserId: actor.userId,
      action: 'clinical_record.access_denied',
      occurredAt,
      correlationId: metadata.correlationId,
      reason: organizationDecision.reason,
    });
    throw new Error(`Acesso negado: ${organizationDecision.reason}.`);
  }
  const records = await dependencies.records.list({
    ...filter,
    organizationId: actor.organizationId,
  });
  const authorized = records.filter(
    (record) =>
      authorizeStaff(actor, 'clinical_records.read', {
        organizationId: record.organizationId,
        patientId: record.patientId,
        assignedProfessionalIds: record.assignedProfessionalIds,
      }).allowed
  );
  await dependencies.accessAudit.append({
    id: auditId(metadata, 'listed'),
    organizationId: actor.organizationId,
    actorUserId: actor.userId,
    action: 'clinical_record.listed',
    occurredAt,
    correlationId: metadata.correlationId,
    resultCount: authorized.length,
  });
  return authorized;
}
