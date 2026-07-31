import {
  createSessionEvent,
  evolveSession,
  type TransitionMetadata,
} from './eventFactory';
import type {
  ClinicalSession,
  SessionTransitionResult,
} from './types';
import { requireStatus, requireText } from './validation';

export function cancelClinicalSession(
  session: ClinicalSession,
  reasonCode: string,
  metadata: TransitionMetadata
): SessionTransitionResult {
  requireStatus(session.status, ['scheduled', 'confirmed'], 'Cancelar');
  const next = evolveSession(
    session,
    {
      status: 'cancelled',
      cancellationReasonCode: requireText(reasonCode, 'reasonCode'),
    },
    metadata.occurredAt
  );
  return {
    session: next,
    events: [
      createSessionEvent(next, 'clinical_session.cancelled', metadata, {
        reasonCode: next.cancellationReasonCode!,
      }),
    ],
  };
}

export function markClinicalSessionNoShow(
  session: ClinicalSession,
  metadata: TransitionMetadata
): SessionTransitionResult {
  requireStatus(session.status, ['scheduled', 'confirmed'], 'Registrar falta');
  if (Date.parse(metadata.occurredAt) < Date.parse(session.scheduledStart)) {
    throw new Error('A falta não pode ser registrada antes do início agendado.');
  }
  const next = evolveSession(
    session,
    { status: 'no_show' },
    metadata.occurredAt
  );
  return {
    session: next,
    events: [createSessionEvent(next, 'clinical_session.no_show', metadata)],
  };
}
