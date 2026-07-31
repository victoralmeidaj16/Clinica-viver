import type {
  ClinicalSession,
  ClinicalSessionEvent,
  ClinicalSessionEventType,
} from './types';
import { requireIsoDate, requireText } from './validation';

export interface TransitionMetadata {
  actorUserId: string;
  occurredAt: string;
  correlationId: string;
}

export function createSessionEvent(
  session: ClinicalSession,
  type: ClinicalSessionEventType,
  metadata: TransitionMetadata,
  details?: ClinicalSessionEvent['metadata']
): ClinicalSessionEvent {
  return {
    id: `${requireText(metadata.correlationId, 'correlationId')}:${type}`,
    type,
    organizationId: session.organizationId,
    sessionId: session.id,
    patientId: session.patientId,
    actorUserId: requireText(metadata.actorUserId, 'actorUserId'),
    occurredAt: requireIsoDate(metadata.occurredAt, 'occurredAt'),
    correlationId: metadata.correlationId,
    metadata: details,
  };
}

export function evolveSession(
  session: ClinicalSession,
  changes: Partial<ClinicalSession>,
  occurredAt: string
): ClinicalSession {
  const normalizedOccurredAt = requireIsoDate(occurredAt, 'occurredAt');
  if (Date.parse(normalizedOccurredAt) < Date.parse(session.updatedAt)) {
    throw new Error('A transição não pode ocorrer antes da última atualização.');
  }
  return {
    ...session,
    ...changes,
    version: session.version + 1,
    updatedAt: normalizedOccurredAt,
  };
}
