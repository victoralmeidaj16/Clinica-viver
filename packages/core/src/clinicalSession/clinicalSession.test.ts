import { describe, expect, it } from 'vitest';
import { createFinancialCharge } from '../financial';
import {
  InMemoryIdentityRepository,
  createOrganization,
  createPatientProfile,
  type StaffAccessContext,
} from '../identity';
import {
  approvePatientHandoff,
  createPatientHandoffDraft,
  markPatientHandoffDelivered,
} from '../patientHandoff';
import {
  attachSessionRecording,
  completeClinicalSession,
  endClinicalSession,
  InMemoryClinicalSessionRepository,
  linkDeliveredPatientHandoff,
  linkSessionCharge,
  markClinicalDraftReady,
  markClinicalSessionNoShow,
  markSessionAutomationFailed,
  markSessionNotificationSent,
  markSessionReceiptIssued,
  recordSessionConsent,
  recordTranscriptionCompleted,
  retrySessionAutomation,
  scheduleClinicalSession,
  scheduleClinicalSessionCommand,
  startAutomationStep,
  startClinicalSession,
  approveClinicalRecord,
  type ClinicalSession,
  type ScheduleClinicalSessionInput,
  type TransitionMetadata,
} from './index';

const organizationId = 'org-1';
const patientId = 'patient-1';
const professionalId = 'professional-1';

function metadata(
  occurredAt: string,
  correlationId = `correlation-${occurredAt}`
): TransitionMetadata {
  return { actorUserId: 'user-professional', occurredAt, correlationId };
}

function scheduleInput(
  overrides: Partial<ScheduleClinicalSessionInput> = {}
): ScheduleClinicalSessionInput {
  return {
    id: 'session-1',
    organizationId,
    patientId,
    primaryProfessionalId: professionalId,
    assignedProfessionalIds: [professionalId],
    mode: 'video',
    scheduledStart: '2026-08-01T12:00:00.000Z',
    scheduledEnd: '2026-08-01T13:00:00.000Z',
    automationPlan: {
      transcription: true,
      patientHandoff: true,
      billing: true,
      receipt: true,
      notification: true,
    },
    createdAt: '2026-08-01T10:00:00.000Z',
    ...overrides,
  };
}

function scheduledSession(
  overrides: Partial<ScheduleClinicalSessionInput> = {}
): ClinicalSession {
  return scheduleClinicalSession(
    scheduleInput(overrides),
    metadata('2026-08-01T10:00:00.000Z')
  ).session;
}

function consent(
  session: ClinicalSession,
  type: 'recording' | 'ai_processing' | 'patient_handoff',
  occurredAt: string
): ClinicalSession {
  return recordSessionConsent(
    session,
    {
      id: `consent-${type}`,
      type,
      status: 'granted',
      grantedBy: { actorType: 'patient', patientId },
      policyVersion: '2026-08',
      capturedAt: occurredAt,
      evidenceReference: `evidence-${type}`,
    },
    metadata(occurredAt)
  ).session;
}

function sessionAwaitingProcessing(): ClinicalSession {
  let session = scheduledSession();
  session = consent(session, 'recording', '2026-08-01T11:00:00.000Z');
  session = consent(session, 'ai_processing', '2026-08-01T11:01:00.000Z');
  session = consent(session, 'patient_handoff', '2026-08-01T11:02:00.000Z');
  session = startClinicalSession(
    session,
    metadata('2026-08-01T12:00:00.000Z')
  ).session;
  session = attachSessionRecording(
    session,
    {
      id: 'recording-1',
      storageKey: 'org-1/session-1/recording.enc',
      capturedAt: '2026-08-01T12:05:00.000Z',
      retentionUntil: '2026-09-01T12:05:00.000Z',
    },
    metadata('2026-08-01T12:06:00.000Z')
  ).session;
  return endClinicalSession(
    session,
    metadata('2026-08-01T13:00:00.000Z')
  ).session;
}

describe('clinical session aggregate', () => {
  it('bloqueia gravação e IA sem consentimentos ativos', () => {
    let session = startClinicalSession(
      scheduledSession(),
      metadata('2026-08-01T12:00:00.000Z')
    ).session;

    expect(() =>
      attachSessionRecording(
        session,
        {
          id: 'recording-1',
          storageKey: 'recording.enc',
          capturedAt: '2026-08-01T12:01:00.000Z',
          retentionUntil: '2026-09-01T12:01:00.000Z',
        },
        metadata('2026-08-01T12:02:00.000Z')
      )
    ).toThrow('Consentimento ativo para gravação');

    session = consent(session, 'recording', '2026-08-01T12:01:00.000Z');
    session = attachSessionRecording(
      session,
      {
        id: 'recording-1',
        storageKey: 'recording.enc',
        capturedAt: '2026-08-01T12:02:00.000Z',
        retentionUntil: '2026-09-01T12:02:00.000Z',
      },
      metadata('2026-08-01T12:03:00.000Z')
    ).session;
    expect(() =>
      endClinicalSession(session, metadata('2026-08-01T13:00:00.000Z'))
    ).toThrow('Consentimento ativo para processamento por IA');
  });

  it('registra falha e permite repetição idempotente da automação', () => {
    let session = sessionAwaitingProcessing();
    session = startAutomationStep(
      session,
      'transcription',
      metadata('2026-08-01T13:01:00.000Z')
    ).session;
    session = markSessionAutomationFailed(
      session,
      'transcription',
      'PROVIDER_TIMEOUT',
      metadata('2026-08-01T13:02:00.000Z')
    ).session;

    expect(session.status).toBe('processing_failed');
    expect(session.automation.transcription.errorCode).toBe('PROVIDER_TIMEOUT');

    session = retrySessionAutomation(
      session,
      'transcription',
      metadata('2026-08-01T13:03:00.000Z')
    ).session;
    session = startAutomationStep(
      session,
      'transcription',
      metadata('2026-08-01T13:04:00.000Z')
    ).session;
    expect(session.automation.transcription.attemptCount).toBe(2);
  });

  it('impede falta antes do horário e recibo sem cobrança', () => {
    const session = scheduledSession();
    expect(() =>
      markClinicalSessionNoShow(
        session,
        metadata('2026-08-01T11:59:59.000Z')
      )
    ).toThrow('antes do início agendado');
    expect(() =>
      scheduledSession({
        automationPlan: {
          transcription: false,
          patientHandoff: false,
          billing: false,
          receipt: true,
          notification: false,
        },
      })
    ).toThrow('recibo exige cobrança');
  });
});

describe('clinical session persistence and authorization', () => {
  it('isola organização, grava outbox e repete comando sem duplicar sessão', async () => {
    const organization = createOrganization({
      id: organizationId,
      type: 'clinic',
      displayName: 'Clínica Horizonte',
      timezone: 'America/Sao_Paulo',
      createdAt: '2026-08-01T09:00:00.000Z',
    });
    const patient = createPatientProfile({
      id: patientId,
      organizationId,
      displayName: 'Paciente Fictício',
      primaryProfessionalId: professionalId,
      assignedProfessionalIds: [professionalId],
      createdAt: '2026-08-01T09:00:00.000Z',
    });
    const identities = new InMemoryIdentityRepository({
      organizations: [organization],
      patients: [patient],
    });
    const sessions = new InMemoryClinicalSessionRepository();
    const actor: StaffAccessContext = {
      actorType: 'staff',
      organizationId,
      userId: 'user-professional',
      membershipId: 'membership-1',
      membershipStatus: 'active',
      roles: ['professional'],
      professionalProfileId: professionalId,
    };
    const commandMetadata = {
      ...metadata('2026-08-01T10:00:00.000Z', 'schedule-session-1'),
      commandId: 'command-1',
    };

    const first = await scheduleClinicalSessionCommand(
      { sessions, identities },
      actor,
      scheduleInput(),
      commandMetadata
    );
    const replay = await scheduleClinicalSessionCommand(
      { sessions, identities },
      actor,
      scheduleInput(),
      commandMetadata
    );

    expect(first.idempotentReplay).toBe(false);
    expect(replay.idempotentReplay).toBe(true);
    expect(sessions.listOutboxEvents()).toHaveLength(1);
    await expect(
      sessions.getById('org-2', first.session.id)
    ).resolves.toBeNull();
  });

  it('detecta conflito de versão na persistência otimista', async () => {
    const session = scheduledSession();
    const repository = new InMemoryClinicalSessionRepository([session]);
    await expect(
      repository.commit({
        session: { ...session, version: session.version + 1 },
        expectedVersion: 0,
        commandId: 'stale-command',
        events: [],
      })
    ).rejects.toThrow('Conflito de versão');
  });
});

describe('clinical session one-click completion', () => {
  it('só conclui após prontuário, entrega, cobrança, recibo e notificação', () => {
    let session = sessionAwaitingProcessing();
    session = startAutomationStep(
      session,
      'transcription',
      metadata('2026-08-01T13:01:00.000Z')
    ).session;
    session = recordTranscriptionCompleted(
      session,
      {
        id: 'transcription-1',
        recordingId: 'recording-1',
        producedAt: '2026-08-01T13:02:00.000Z',
        providerReference: 'provider-job-1',
      },
      metadata('2026-08-01T13:03:00.000Z')
    ).session;
    session = startAutomationStep(
      session,
      'clinical_draft',
      metadata('2026-08-01T13:04:00.000Z')
    ).session;
    session = markClinicalDraftReady(
      session,
      'draft-1',
      metadata('2026-08-01T13:05:00.000Z')
    ).session;
    session = approveClinicalRecord(
      session,
      'record-1',
      metadata('2026-08-01T13:06:00.000Z')
    ).session;

    expect(() =>
      completeClinicalSession(
        session,
        metadata('2026-08-01T13:07:00.000Z')
      )
    ).toThrow('Etapas pós-sessão pendentes');

    const handoffDraft = createPatientHandoffDraft({
      patientId,
      sessionId: session.id,
      summary:
        'Conversamos sobre estratégias práticas para organizar a rotina desta semana.',
      tasks: ['Praticar respiração consciente uma vez ao dia'],
      professionalName: 'Dra. Camila',
    });
    const deliveredHandoff = markPatientHandoffDelivered(
      approvePatientHandoff(
        handoffDraft,
        professionalId,
        '2026-08-01T13:07:00.000Z'
      ),
      '2026-08-01T13:08:00.000Z'
    );
    session = linkDeliveredPatientHandoff(
      session,
      deliveredHandoff,
      metadata('2026-08-01T13:09:00.000Z')
    ).session;

    const charge = createFinancialCharge({
      id: 'charge-1',
      organizationId,
      sessionId: session.id,
      patientId,
      professionalId,
      issuedAt: '2026-08-01T13:10:00.000Z',
      dueAt: '2026-08-05T23:59:59.000Z',
      amountCents: 25000,
      createdAt: '2026-08-01T13:10:00.000Z',
    });
    session = linkSessionCharge(
      session,
      charge,
      metadata('2026-08-01T13:11:00.000Z')
    ).session;
    session = markSessionReceiptIssued(
      session,
      'receipt-1',
      metadata('2026-08-01T13:12:00.000Z')
    ).session;
    session = markSessionNotificationSent(
      session,
      'message-1',
      metadata('2026-08-01T13:13:00.000Z')
    ).session;
    session = completeClinicalSession(
      session,
      metadata('2026-08-01T13:14:00.000Z')
    ).session;

    expect(session.status).toBe('completed');
    expect(session.artifacts).toMatchObject({
      approvedClinicalRecordId: 'record-1',
      patientHandoffSessionId: 'session-1',
      chargeId: 'charge-1',
      receiptId: 'receipt-1',
    });
  });
});
