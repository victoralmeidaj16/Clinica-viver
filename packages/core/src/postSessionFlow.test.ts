import { describe, expect, it } from 'vitest';
import {
  computeSoapContentHash,
  createClinicalRecordDraft,
  InMemoryClinicalRecordRepository,
  approveClinicalRecordRevisionCommand,
  type ClinicalRecord,
  type SoapClinicalContent,
} from './clinicalRecord';
import {
  approveClinicalRecordCommand,
  attachSessionRecording,
  completeClinicalSessionCommand,
  endClinicalSession,
  InMemoryClinicalSessionRepository,
  linkDeliveredPatientHandoffCommand,
  linkSessionChargeCommand,
  markClinicalDraftReady,
  markSessionAutomationFailedCommand,
  markSessionNotificationSentCommand,
  markSessionReceiptIssuedCommand,
  recordSessionConsent,
  recordTranscriptionCompleted,
  scheduleClinicalSession,
  startClinicalSession,
  type ClinicalSession,
} from './clinicalSession';
import { createFinancialCharge } from './financial';
import {
  createOrganization,
  createPatientProfile,
  InMemoryIdentityRepository,
  type StaffAccessContext,
} from './identity';
import {
  approvePatientHandoff,
  createPatientHandoffDraft,
  markPatientHandoffDelivered,
} from './patientHandoff';
import { projectApprovedClinicalRecord } from './clinicalTimeline';

const organizationId = 'org-1';
const patientId = 'patient-1';
const professionalId = 'professional-1';
const userId = 'user-professional';
const transcriptionId = 'transcription-1';

const content: SoapClinicalContent = {
  subjective: 'Relato de oscilações de ansiedade associadas à rotina de trabalho.',
  objective: 'Orientada, colaborativa, discurso organizado.',
  assessment: 'Evolução consistente com o plano em curso.',
  plan: 'Manter registro diário de gatilhos e ampliar prática de respiração.',
  extractedTasks: ['Registrar três momentos positivos do dia'],
};

function metadata(occurredAt: string, commandId: string) {
  return { actorUserId: userId, occurredAt, correlationId: `flow-${commandId}`, commandId };
}

function actorWith(roles: StaffAccessContext['roles']): StaffAccessContext {
  return {
    actorType: 'staff', organizationId, userId, membershipId: 'membership-1',
    membershipStatus: 'active', roles, professionalProfileId: professionalId,
  };
}

const actor = actorWith(['professional', 'billing']);

function sessionAwaitingReview(): { session: ClinicalSession; record: ClinicalRecord } {
  let session = scheduleClinicalSession(
    {
      id: 'session-1', organizationId, patientId, primaryProfessionalId: professionalId,
      assignedProfessionalIds: [professionalId], mode: 'video',
      scheduledStart: '2026-08-01T12:00:00.000Z', scheduledEnd: '2026-08-01T13:00:00.000Z',
      automationPlan: { transcription: true, patientHandoff: true, billing: true, receipt: true, notification: true },
      createdAt: '2026-08-01T10:00:00.000Z',
    },
    metadata('2026-08-01T10:00:00.000Z', 'schedule')
  ).session;

  (['recording', 'ai_processing', 'patient_handoff'] as const).forEach((type, index) => {
    session = recordSessionConsent(
      session,
      {
        id: `consent-${type}`, type, status: 'granted',
        grantedBy: { actorType: 'patient', patientId },
        policyVersion: '2026-08', capturedAt: '2026-08-01T11:00:00.000Z',
      },
      metadata(`2026-08-01T11:0${index}:00.000Z`, `consent-${type}`)
    ).session;
  });

  session = startClinicalSession(session, metadata('2026-08-01T12:00:00.000Z', 'start')).session;
  session = attachSessionRecording(
    session,
    {
      id: 'recording-1', storageKey: 'org-1/session-1/recording.enc',
      capturedAt: '2026-08-01T12:05:00.000Z', retentionUntil: '2031-08-01T12:05:00.000Z',
    },
    metadata('2026-08-01T12:06:00.000Z', 'recording')
  ).session;
  session = endClinicalSession(session, metadata('2026-08-01T13:00:00.000Z', 'end')).session;
  session = recordTranscriptionCompleted(
    session,
    { id: transcriptionId, recordingId: 'recording-1', producedAt: '2026-08-01T13:02:00.000Z' },
    metadata('2026-08-01T13:02:00.000Z', 'transcription')
  ).session;

  const record = createClinicalRecordDraft(
    {
      id: 'record-1', revisionId: 'record-1-rev-1', organizationId, patientId,
      sessionId: 'session-1', responsibleProfessionalId: professionalId,
      assignedProfessionalIds: [professionalId], source: 'ai_assisted', content,
      aiProvenance: {
        provider: 'demo', model: 'demo-soap', promptVersion: '2026-08',
        transcriptionId, generatedAt: '2026-08-01T13:03:00.000Z',
      },
      retentionUntil: '2031-08-01T13:05:00.000Z', createdAt: '2026-08-01T13:05:00.000Z',
    },
    metadata('2026-08-01T13:05:00.000Z', 'draft')
  ).record;

  session = markClinicalDraftReady(session, record.id, metadata('2026-08-01T13:06:00.000Z', 'draft-ready')).session;
  return { session, record };
}

function repositories(seed: { session: ClinicalSession; record: ClinicalRecord }) {
  const organization = createOrganization({
    id: organizationId, type: 'solo_practice', displayName: 'Consultório',
    timezone: 'America/Sao_Paulo', createdAt: '2026-08-01T09:00:00.000Z',
  });
  const patient = createPatientProfile({
    id: patientId, organizationId, displayName: 'Paciente Fictício',
    primaryProfessionalId: professionalId, assignedProfessionalIds: [professionalId],
    createdAt: '2026-08-01T09:00:00.000Z',
  });
  return {
    sessions: new InMemoryClinicalSessionRepository([seed.session]),
    records: new InMemoryClinicalRecordRepository([seed.record]),
    identities: new InMemoryIdentityRepository({ organizations: [organization], patients: [patient] }),
  };
}

const at = '2026-08-01T14:00:00.000Z';

describe('automação pós-sessão em 1 clique', () => {
  it('mantém o hash do conteúdo aprovado estável e verificável', async () => {
    const first = await computeSoapContentHash(content);
    const reordered = await computeSoapContentHash({
      ...content,
      extractedTasks: [...content.extractedTasks].reverse(),
    });
    const changed = await computeSoapContentHash({ ...content, plan: `${content.plan} Revisado.` });

    expect(first).toMatch(/^[a-f0-9]{64}$/);
    expect(reordered).toBe(first);
    expect(changed).not.toBe(first);
  });

  it('percorre aprovação, entrega, cobrança, recibo e notificação até concluir', async () => {
    const seed = sessionAwaitingReview();
    const { sessions, records, identities } = repositories(seed);
    const contentHashSha256 = await computeSoapContentHash(content);

    const approved = await approveClinicalRecordRevisionCommand(
      { records, sessions }, actor, seed.record.id,
      { professionalId, contentHashSha256, approvalId: 'approval-1' },
      metadata(at, 'record')
    );
    expect(approved.record.status).toBe('approved');

    const afterApproval = await approveClinicalRecordCommand(
      { sessions, identities }, actor, 'session-1', approved.record.id, metadata(at, 'session-approve')
    );
    expect(afterApproval.session.status).toBe('ready_to_complete');

    const entries = projectApprovedClinicalRecord(approved.record);
    expect(entries).toHaveLength(4);
    expect(entries.every((entry) => entry.evidence.contentHashSha256 === contentHashSha256)).toBe(true);

    const handoff = markPatientHandoffDelivered(
      approvePatientHandoff(
        createPatientHandoffDraft({
          patientId, sessionId: 'session-1',
          summary: 'Combinamos manter o registro diário e retomar a prática de respiração antes de dormir.',
          tasks: ['Registrar três momentos positivos do dia'], professionalName: 'Dra. Camila',
        }),
        userId, at
      ),
      at
    );
    await linkDeliveredPatientHandoffCommand({ sessions, identities }, actor, 'session-1', handoff, metadata(at, 'handoff'));

    const charge = createFinancialCharge({
      id: 'charge-session-1', organizationId, sessionId: 'session-1', patientId,
      professionalId, issuedAt: at, dueAt: '2026-08-08T23:59:00.000Z',
      amountCents: 25000, createdAt: at,
    });
    await linkSessionChargeCommand({ sessions, identities }, actor, 'session-1', charge, metadata(at, 'billing'));
    await markSessionReceiptIssuedCommand({ sessions, identities }, actor, 'session-1', 'receipt-1', metadata(at, 'receipt'));
    await markSessionNotificationSentCommand({ sessions, identities }, actor, 'session-1', 'notification-1', metadata(at, 'notification'));

    const completed = await completeClinicalSessionCommand({ sessions, identities }, actor, 'session-1', metadata(at, 'complete'));
    expect(completed.session.status).toBe('completed');
    expect(completed.session.artifacts.chargeId).toBe('charge-session-1');
    expect(completed.session.artifacts.receiptId).toBe('receipt-1');
  });

  it('reproduz o resultado quando o mesmo comando é reenviado', async () => {
    const seed = sessionAwaitingReview();
    const { sessions, records, identities } = repositories(seed);
    const contentHashSha256 = await computeSoapContentHash(content);
    const approvalMetadata = metadata(at, 'record');

    const first = await approveClinicalRecordRevisionCommand(
      { records, sessions }, actor, seed.record.id,
      { professionalId, contentHashSha256, approvalId: 'approval-1' }, approvalMetadata
    );
    const replay = await approveClinicalRecordRevisionCommand(
      { records, sessions }, actor, seed.record.id,
      { professionalId, contentHashSha256, approvalId: 'approval-1' }, approvalMetadata
    );

    expect(first.idempotentReplay).toBe(false);
    expect(replay.idempotentReplay).toBe(true);
    expect(replay.record.approvals).toHaveLength(1);
  });

  it('exige papel financeiro para vincular a cobrança da sessão', async () => {
    const seed = sessionAwaitingReview();
    const { sessions, records, identities } = repositories(seed);
    const contentHashSha256 = await computeSoapContentHash(content);
    const clinicalOnly = actorWith(['professional']);

    const approved = await approveClinicalRecordRevisionCommand(
      { records, sessions }, clinicalOnly, seed.record.id,
      { professionalId, contentHashSha256, approvalId: 'approval-1' }, metadata(at, 'record')
    );
    await approveClinicalRecordCommand(
      { sessions, identities }, clinicalOnly, 'session-1', approved.record.id, metadata(at, 'session-approve')
    );
    const charge = createFinancialCharge({
      id: 'charge-session-1', organizationId, sessionId: 'session-1', patientId,
      professionalId, issuedAt: at, dueAt: '2026-08-08T23:59:00.000Z', amountCents: 25000, createdAt: at,
    });

    await expect(
      linkSessionChargeCommand({ sessions, identities }, clinicalOnly, 'session-1', charge, metadata(at, 'billing'))
    ).rejects.toThrow('Acesso negado: permission_missing.');
  });

  it('preserva o prontuário aprovado quando uma etapa posterior falha', async () => {
    const seed = sessionAwaitingReview();
    const { sessions, records, identities } = repositories(seed);
    const contentHashSha256 = await computeSoapContentHash(content);

    const approved = await approveClinicalRecordRevisionCommand(
      { records, sessions }, actor, seed.record.id,
      { professionalId, contentHashSha256, approvalId: 'approval-1' }, metadata(at, 'record')
    );
    await approveClinicalRecordCommand(
      { sessions, identities }, actor, 'session-1', approved.record.id, metadata(at, 'session-approve')
    );

    const failed = await markSessionAutomationFailedCommand(
      { sessions, identities }, actor, 'session-1', 'notification', 'NOTIFICATION_FAILED', metadata(at, 'notification-failed')
    );

    expect(failed.session.status).toBe('ready_to_complete');
    expect(failed.session.automation.notification.status).toBe('failed');
    expect(failed.session.automation.clinicalDraft.status).toBe('approved');
    await expect(
      completeClinicalSessionCommand({ sessions, identities }, actor, 'session-1', metadata(at, 'complete'))
    ).rejects.toThrow('Etapas pós-sessão pendentes');

    const stored = await records.getById(organizationId, seed.record.id);
    expect(stored?.status).toBe('approved');
  });
});
