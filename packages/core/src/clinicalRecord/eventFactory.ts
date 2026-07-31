import type {
  ClinicalRecord,
  ClinicalRecordEvent,
  ClinicalRecordEventType,
} from './types';
import { requireRecordIsoDate, requireRecordText } from './validation';

export interface ClinicalRecordCommandMetadata {
  actorUserId: string;
  occurredAt: string;
  correlationId: string;
}

export function createClinicalRecordEvent(
  record: ClinicalRecord,
  type: ClinicalRecordEventType,
  metadata: ClinicalRecordCommandMetadata,
  details?: ClinicalRecordEvent['metadata']
): ClinicalRecordEvent {
  const correlationId = requireRecordText(
    metadata.correlationId,
    'correlationId'
  );
  return {
    id: `${correlationId}:${type}`,
    type,
    organizationId: record.organizationId,
    recordId: record.id,
    patientId: record.patientId,
    sessionId: record.sessionId,
    actorUserId: requireRecordText(metadata.actorUserId, 'actorUserId'),
    occurredAt: requireRecordIsoDate(metadata.occurredAt, 'occurredAt'),
    correlationId,
    metadata: details,
  };
}

export function evolveClinicalRecord(
  record: ClinicalRecord,
  changes: Partial<ClinicalRecord>,
  occurredAt: string
): ClinicalRecord {
  const normalized = requireRecordIsoDate(occurredAt, 'occurredAt');
  if (Date.parse(normalized) < Date.parse(record.updatedAt)) {
    throw new Error('A alteração não pode anteceder a última atualização.');
  }
  return {
    ...record,
    ...changes,
    version: record.version + 1,
    updatedAt: normalized,
  };
}
