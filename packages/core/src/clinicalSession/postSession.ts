import type { PatientHandoff } from '../patientHandoff';
import {
  createSessionEvent,
  evolveSession,
  type TransitionMetadata,
} from './eventFactory';
import { hasActiveConsent } from './lifecycle';
import type {
  AutomationStepName,
  AutomationStepState,
  ClinicalSession,
  SessionTransitionResult,
  TranscriptionReference,
} from './types';
import { requireIsoDate, requireStatus, requireText } from './validation';

type AutomationKey = keyof ClinicalSession['automation'];

const STEP_KEYS: Readonly<Record<AutomationStepName, AutomationKey>> = {
  transcription: 'transcription',
  clinical_draft: 'clinicalDraft',
  patient_handoff: 'patientHandoff',
  billing: 'billing',
  receipt: 'receipt',
  notification: 'notification',
};

function replaceStep(
  session: ClinicalSession,
  step: AutomationStepName,
  next: AutomationStepState
): ClinicalSession['automation'] {
  return { ...session.automation, [STEP_KEYS[step]]: next };
}

export function startAutomationStep(
  session: ClinicalSession,
  step: AutomationStepName,
  metadata: TransitionMetadata
): SessionTransitionResult {
  if (
    step === 'transcription' &&
    session.status !== 'awaiting_processing'
  ) {
    throw new Error('A transcrição só pode iniciar após o encerramento.');
  }
  if (step === 'clinical_draft') {
    requireStatus(
      session.status,
      ['awaiting_processing', 'awaiting_review'],
      'Iniciar rascunho clínico'
    );
    if (
      session.automationPlan.transcription &&
      session.automation.transcription.status !== 'completed'
    ) {
      throw new Error('O rascunho automático exige a transcrição concluída.');
    }
  }
  if (
    !['transcription', 'clinical_draft'].includes(step) &&
    session.status !== 'ready_to_complete'
  ) {
    throw new Error(`A etapa ${step} exige o prontuário aprovado.`);
  }
  const current = session.automation[STEP_KEYS[step]];
  if (!['idle', 'queued'].includes(current.status)) {
    throw new Error(`A etapa ${step} não está disponível para processamento.`);
  }
  const next = evolveSession(
    session,
    {
      automation: replaceStep(session, step, {
        status: 'processing',
        attemptCount: current.attemptCount + 1,
        updatedAt: metadata.occurredAt,
      }),
    },
    metadata.occurredAt
  );
  return { session: next, events: [] };
}

export function recordTranscriptionCompleted(
  session: ClinicalSession,
  transcription: TranscriptionReference,
  metadata: TransitionMetadata
): SessionTransitionResult {
  requireStatus(
    session.status,
    ['awaiting_processing', 'processing_failed'],
    'Concluir transcrição'
  );
  if (!session.artifacts.recording) {
    throw new Error('A transcrição exige uma gravação vinculada.');
  }
  requireText(transcription.id, 'transcription.id');
  requireText(transcription.recordingId, 'recordingId');
  if (transcription.recordingId !== session.artifacts.recording.id) {
    throw new Error('A transcrição não pertence à gravação da sessão.');
  }
  requireIsoDate(transcription.producedAt, 'producedAt');
  if (
    Date.parse(transcription.producedAt) <
      Date.parse(session.artifacts.recording.capturedAt) ||
    Date.parse(transcription.producedAt) > Date.parse(metadata.occurredAt)
  ) {
    throw new Error('A data de produção da transcrição é inconsistente.');
  }
  const next = evolveSession(
    session,
    {
      status: 'awaiting_processing',
      artifacts: { ...session.artifacts, transcription: { ...transcription } },
      automation: {
        ...session.automation,
        transcription: {
          ...session.automation.transcription,
          status: 'completed',
          updatedAt: metadata.occurredAt,
          errorCode: undefined,
        },
        clinicalDraft: {
          ...session.automation.clinicalDraft,
          status: 'queued',
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
        'clinical_session.transcription_completed',
        metadata
      ),
    ],
  };
}

export function markClinicalDraftReady(
  session: ClinicalSession,
  clinicalDraftId: string,
  metadata: TransitionMetadata
): SessionTransitionResult {
  requireStatus(
    session.status,
    ['awaiting_processing', 'processing_failed', 'awaiting_review'],
    'Disponibilizar rascunho'
  );
  if (
    session.automationPlan.transcription &&
    session.automation.transcription.status !== 'completed'
  ) {
    throw new Error('O rascunho automático exige a transcrição concluída.');
  }
  const next = evolveSession(
    session,
    {
      status: 'awaiting_review',
      artifacts: {
        ...session.artifacts,
        clinicalDraftId: requireText(clinicalDraftId, 'clinicalDraftId'),
      },
      automation: {
        ...session.automation,
        clinicalDraft: {
          ...session.automation.clinicalDraft,
          status: 'requires_review',
          updatedAt: metadata.occurredAt,
          errorCode: undefined,
        },
      },
    },
    metadata.occurredAt
  );
  return {
    session: next,
    events: [
      createSessionEvent(next, 'clinical_session.draft_ready', metadata),
    ],
  };
}

export function approveClinicalRecord(
  session: ClinicalSession,
  approvedClinicalRecordId: string,
  metadata: TransitionMetadata
): SessionTransitionResult {
  requireStatus(session.status, ['awaiting_review'], 'Aprovar prontuário');
  if (session.automation.clinicalDraft.status !== 'requires_review') {
    throw new Error('Não há rascunho clínico aguardando revisão.');
  }
  const next = evolveSession(
    session,
    {
      status: 'ready_to_complete',
      artifacts: {
        ...session.artifacts,
        approvedClinicalRecordId: requireText(
          approvedClinicalRecordId,
          'approvedClinicalRecordId'
        ),
      },
      automation: {
        ...session.automation,
        clinicalDraft: {
          ...session.automation.clinicalDraft,
          status: 'approved',
          updatedAt: metadata.occurredAt,
        },
      },
    },
    metadata.occurredAt
  );
  return {
    session: next,
    events: [
      createSessionEvent(next, 'clinical_session.record_approved', metadata),
    ],
  };
}

export function linkDeliveredPatientHandoff(
  session: ClinicalSession,
  handoff: PatientHandoff,
  metadata: TransitionMetadata
): SessionTransitionResult {
  requireStatus(session.status, ['ready_to_complete'], 'Vincular entrega');
  if (!session.automationPlan.patientHandoff) {
    throw new Error('A entrega ao paciente não está habilitada.');
  }
  if (!hasActiveConsent(session, 'patient_handoff')) {
    throw new Error('Consentimento para entrega ao paciente é obrigatório.');
  }
  if (
    handoff.sessionId !== session.id ||
    handoff.patientId !== session.patientId ||
    handoff.status !== 'delivered'
  ) {
    throw new Error('A entrega deve estar concluída e pertencer à sessão.');
  }
  const next = evolveSession(
    session,
    {
      artifacts: {
        ...session.artifacts,
        patientHandoffSessionId: handoff.sessionId,
      },
      automation: {
        ...session.automation,
        patientHandoff: {
          ...session.automation.patientHandoff,
          status: 'completed',
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
        'clinical_session.handoff_delivered',
        metadata
      ),
    ],
  };
}
