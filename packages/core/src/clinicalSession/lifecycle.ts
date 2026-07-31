import {
  createSessionEvent,
  evolveSession,
  type TransitionMetadata,
} from './eventFactory';
import type {
  AutomationStepState,
  ClinicalSession,
  RecordingReference,
  SessionAutomationPlan,
  SessionAutomationState,
  SessionConsentRecord,
  SessionConsentType,
  SessionTransitionResult,
} from './types';
import { requireIsoDate, requireStatus, requireText } from './validation';

function step(
  enabled: boolean,
  createdAt: string
): AutomationStepState {
  return {
    status: enabled ? 'idle' : 'skipped',
    attemptCount: 0,
    updatedAt: createdAt,
  };
}

function createAutomation(
  plan: SessionAutomationPlan,
  createdAt: string
): SessionAutomationState {
  return {
    transcription: step(plan.transcription, createdAt),
    clinicalDraft: step(true, createdAt),
    patientHandoff: step(plan.patientHandoff, createdAt),
    billing: step(plan.billing, createdAt),
    receipt: step(plan.receipt, createdAt),
    notification: step(plan.notification, createdAt),
  };
}

export interface ScheduleClinicalSessionInput {
  id: string;
  organizationId: string;
  patientId: string;
  primaryProfessionalId: string;
  assignedProfessionalIds: readonly string[];
  mode: ClinicalSession['mode'];
  scheduledStart: string;
  scheduledEnd: string;
  automationPlan: SessionAutomationPlan;
  createdAt: string;
}

export function scheduleClinicalSession(
  input: ScheduleClinicalSessionInput,
  metadata: TransitionMetadata
): SessionTransitionResult {
  if (input.automationPlan.receipt && !input.automationPlan.billing) {
    throw new Error('A emissão de recibo exige cobrança habilitada.');
  }
  const scheduledStart = requireIsoDate(input.scheduledStart, 'scheduledStart');
  const scheduledEnd = requireIsoDate(input.scheduledEnd, 'scheduledEnd');
  if (Date.parse(scheduledEnd) <= Date.parse(scheduledStart)) {
    throw new Error('scheduledEnd deve ser posterior a scheduledStart.');
  }
  const assignedProfessionalIds = Array.from(
    new Set(
      input.assignedProfessionalIds.map((id) =>
        requireText(id, 'assignedProfessionalId')
      )
    )
  );
  const primaryProfessionalId = requireText(
    input.primaryProfessionalId,
    'primaryProfessionalId'
  );
  if (!assignedProfessionalIds.includes(primaryProfessionalId)) {
    throw new Error('O profissional principal deve estar atribuído à sessão.');
  }
  const createdAt = requireIsoDate(input.createdAt, 'createdAt');
  if (Date.parse(metadata.occurredAt) < Date.parse(createdAt)) {
    throw new Error('O evento de agendamento não pode ser anterior à criação.');
  }
  const session: ClinicalSession = {
    schemaVersion: 1,
    id: requireText(input.id, 'id'),
    organizationId: requireText(input.organizationId, 'organizationId'),
    patientId: requireText(input.patientId, 'patientId'),
    primaryProfessionalId,
    assignedProfessionalIds,
    status: 'scheduled',
    mode: input.mode,
    scheduledStart,
    scheduledEnd,
    consentRecords: [],
    automationPlan: { ...input.automationPlan },
    automation: createAutomation(input.automationPlan, createdAt),
    artifacts: {},
    version: 1,
    createdAt,
    updatedAt: createdAt,
  };
  return {
    session,
    events: [
      createSessionEvent(session, 'clinical_session.scheduled', metadata),
    ],
  };
}

export function confirmClinicalSession(
  session: ClinicalSession,
  metadata: TransitionMetadata
): SessionTransitionResult {
  requireStatus(session.status, ['scheduled'], 'Confirmar');
  const next = evolveSession(
    session,
    { status: 'confirmed' },
    metadata.occurredAt
  );
  return {
    session: next,
    events: [createSessionEvent(next, 'clinical_session.confirmed', metadata)],
  };
}

export function startClinicalSession(
  session: ClinicalSession,
  metadata: TransitionMetadata
): SessionTransitionResult {
  requireStatus(session.status, ['scheduled', 'confirmed'], 'Iniciar');
  const next = evolveSession(
    session,
    { status: 'in_progress', actualStart: metadata.occurredAt },
    metadata.occurredAt
  );
  return {
    session: next,
    events: [createSessionEvent(next, 'clinical_session.started', metadata)],
  };
}

export function recordSessionConsent(
  session: ClinicalSession,
  consent: SessionConsentRecord,
  metadata: TransitionMetadata
): SessionTransitionResult {
  requireStatus(
    session.status,
    ['scheduled', 'confirmed', 'in_progress'],
    'Registrar consentimento'
  );
  requireText(consent.id, 'consent.id');
  requireText(consent.policyVersion, 'policyVersion');
  requireIsoDate(consent.capturedAt, 'capturedAt');
  if (Date.parse(consent.capturedAt) > Date.parse(metadata.occurredAt)) {
    throw new Error('O consentimento não pode ser capturado no futuro.');
  }
  if (
    consent.grantedBy.actorType === 'patient' &&
    consent.grantedBy.patientId !== session.patientId
  ) {
    throw new Error('O consentimento não pertence ao paciente da sessão.');
  }
  if (consent.grantedBy.actorType === 'responsible') {
    requireText(
      consent.grantedBy.responsiblePartyId,
      'responsiblePartyId'
    );
  }
  const next = evolveSession(
    session,
    {
      consentRecords: [
        ...session.consentRecords.filter(
          (item) => item.id !== consent.id
        ),
        { ...consent },
      ],
    },
    metadata.occurredAt
  );
  return {
    session: next,
    events: [
      createSessionEvent(next, 'clinical_session.consent_recorded', metadata, {
        consentType: consent.type,
        consentStatus: consent.status,
      }),
    ],
  };
}

export function hasActiveConsent(
  session: ClinicalSession,
  type: SessionConsentType
): boolean {
  const latest = session.consentRecords
    .filter((item) => item.type === type)
    .sort((a, b) => b.capturedAt.localeCompare(a.capturedAt))[0];
  return latest?.status === 'granted';
}

export function attachSessionRecording(
  session: ClinicalSession,
  recording: RecordingReference,
  metadata: TransitionMetadata
): SessionTransitionResult {
  requireStatus(session.status, ['in_progress'], 'Anexar gravação');
  if (!hasActiveConsent(session, 'recording')) {
    throw new Error('Consentimento ativo para gravação é obrigatório.');
  }
  requireText(recording.id, 'recording.id');
  requireText(recording.storageKey, 'storageKey');
  requireIsoDate(recording.capturedAt, 'capturedAt');
  requireIsoDate(recording.retentionUntil, 'retentionUntil');
  if (Date.parse(recording.capturedAt) > Date.parse(metadata.occurredAt)) {
    throw new Error('A gravação não pode ser capturada no futuro.');
  }
  if (Date.parse(recording.retentionUntil) <= Date.parse(recording.capturedAt)) {
    throw new Error('A retenção da gravação deve ser posterior à captura.');
  }
  const next = evolveSession(
    session,
    { artifacts: { ...session.artifacts, recording: { ...recording } } },
    metadata.occurredAt
  );
  return {
    session: next,
    events: [
      createSessionEvent(next, 'clinical_session.recording_attached', metadata),
    ],
  };
}

export function endClinicalSession(
  session: ClinicalSession,
  metadata: TransitionMetadata
): SessionTransitionResult {
  requireStatus(session.status, ['in_progress'], 'Encerrar');
  if (
    session.actualStart &&
    Date.parse(metadata.occurredAt) < Date.parse(session.actualStart)
  ) {
    throw new Error('A sessão não pode terminar antes de começar.');
  }
  if (session.automationPlan.transcription) {
    if (!session.artifacts.recording) {
      throw new Error('A transcrição planejada exige uma gravação vinculada.');
    }
    if (!hasActiveConsent(session, 'ai_processing')) {
      throw new Error('Consentimento ativo para processamento por IA é obrigatório.');
    }
  }
  const status = session.automationPlan.transcription
    ? 'awaiting_processing'
    : 'awaiting_review';
  const next = evolveSession(
    session,
    {
      status,
      actualEnd: metadata.occurredAt,
      automation: {
        ...session.automation,
        transcription: session.automationPlan.transcription
          ? {
              status: 'queued',
              attemptCount: 0,
              updatedAt: metadata.occurredAt,
            }
          : session.automation.transcription,
      },
    },
    metadata.occurredAt
  );
  return {
    session: next,
    events: [createSessionEvent(next, 'clinical_session.ended', metadata)],
  };
}
