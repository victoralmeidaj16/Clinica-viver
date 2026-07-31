import {
  createSessionEvent,
  evolveSession,
  type TransitionMetadata,
} from './eventFactory';
import type {
  AutomationStepName,
  ClinicalSession,
  SessionTransitionResult,
} from './types';
import { requireText } from './validation';

type AutomationKey = keyof ClinicalSession['automation'];

const STEP_KEYS: Readonly<Record<AutomationStepName, AutomationKey>> = {
  transcription: 'transcription',
  clinical_draft: 'clinicalDraft',
  patient_handoff: 'patientHandoff',
  billing: 'billing',
  receipt: 'receipt',
  notification: 'notification',
};

export function markSessionAutomationFailed(
  session: ClinicalSession,
  step: AutomationStepName,
  errorCode: string,
  metadata: TransitionMetadata
): SessionTransitionResult {
  const key = STEP_KEYS[step];
  const current = session.automation[key];
  if (['skipped', 'completed', 'approved'].includes(current.status)) {
    throw new Error(`A etapa ${step} não pode ser marcada como falha.`);
  }
  const normalizedErrorCode = requireText(errorCode, 'errorCode');
  const next = evolveSession(
    session,
    {
      status:
        step === 'transcription' || step === 'clinical_draft'
          ? 'processing_failed'
          : session.status,
      automation: {
        ...session.automation,
        [key]: {
          ...current,
          status: 'failed',
          errorCode: normalizedErrorCode,
          updatedAt: metadata.occurredAt,
        },
      },
    },
    metadata.occurredAt
  );
  return {
    session: next,
    events: [
      createSessionEvent(
        next,
        'clinical_session.automation_failed',
        metadata,
        { step, errorCode: normalizedErrorCode }
      ),
    ],
  };
}

export function retrySessionAutomation(
  session: ClinicalSession,
  step: AutomationStepName,
  metadata: TransitionMetadata
): SessionTransitionResult {
  const key = STEP_KEYS[step];
  const current = session.automation[key];
  if (current.status !== 'failed') {
    throw new Error(`Somente uma etapa com falha pode ser repetida: ${step}.`);
  }
  const next = evolveSession(
    session,
    {
      status:
        session.status === 'processing_failed'
          ? 'awaiting_processing'
          : session.status,
      automation: {
        ...session.automation,
        [key]: {
          ...current,
          status: 'queued',
          errorCode: undefined,
          updatedAt: metadata.occurredAt,
        },
      },
    },
    metadata.occurredAt
  );
  return {
    session: next,
    events: [
      createSessionEvent(
        next,
        'clinical_session.automation_retried',
        metadata,
        { step }
      ),
    ],
  };
}
