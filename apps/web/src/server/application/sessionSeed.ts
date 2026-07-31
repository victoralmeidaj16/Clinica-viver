import {
  attachSessionRecording, createClinicalRecordDraft, endClinicalSession,
  markClinicalDraftReady, recordSessionConsent, recordTranscriptionCompleted,
  scheduleClinicalSession, startClinicalSession, type ClinicalRecord,
  type ClinicalSession, type SessionConsentType,
} from '@thats-life/core';

const CONSENT_TYPES: readonly SessionConsentType[] = [
  'recording', 'ai_processing', 'patient_handoff', 'transactional_communication',
];

export interface SessionSeedInput {
  sessionId: string;
  recordId: string;
  organizationId: string;
  patientId: string;
  professionalId: string;
  actorUserId: string;
  scheduledStart: string;
  scheduledEnd: string;
  createdAt: string;
}

/**
 * Reconstrói uma sessão já encerrada e transcrita, parada em `awaiting_review`.
 * O seed replica as transições reais do agregado em vez de fabricar o estado
 * final, de modo que qualquer regra violada pela máquina de estados apareça na
 * inicialização e não no meio do fluxo de 1 clique.
 */
export function seedSessionAwaitingReview(
  input: SessionSeedInput
): { session: ClinicalSession; record: ClinicalRecord } {
  const at = (offsetMinutes: number) =>
    new Date(Date.parse(input.scheduledStart) + offsetMinutes * 60 * 1000).toISOString();
  const metadata = (occurredAt: string, suffix: string) => ({
    actorUserId: input.actorUserId, occurredAt, correlationId: `seed-${input.sessionId}-${suffix}`,
  });

  let session = scheduleClinicalSession(
    {
      id: input.sessionId, organizationId: input.organizationId, patientId: input.patientId,
      primaryProfessionalId: input.professionalId, assignedProfessionalIds: [input.professionalId],
      mode: 'video', scheduledStart: input.scheduledStart, scheduledEnd: input.scheduledEnd,
      automationPlan: { transcription: true, patientHandoff: true, billing: true, receipt: true, notification: true },
      createdAt: input.createdAt,
    },
    metadata(input.createdAt, 'schedule')
  ).session;

  CONSENT_TYPES.forEach((type, index) => {
    session = recordSessionConsent(
      session,
      {
        id: `${input.sessionId}-consent-${type}`, type, status: 'granted',
        grantedBy: { actorType: 'patient', patientId: input.patientId },
        policyVersion: '2026-07', capturedAt: at(-10),
      },
      metadata(at(-10 + index), `consent-${type}`)
    ).session;
  });

  session = startClinicalSession(session, metadata(at(0), 'start')).session;
  session = attachSessionRecording(
    session,
    {
      id: `${input.sessionId}-recording`, storageKey: `recordings/${input.sessionId}.enc`,
      capturedAt: at(1), retentionUntil: new Date(Date.parse(input.scheduledStart) + 5 * 365 * 24 * 60 * 60 * 1000).toISOString(),
    },
    metadata(at(1), 'recording')
  ).session;
  session = endClinicalSession(session, metadata(at(50), 'end')).session;

  const transcriptionId = `${input.sessionId}-transcription`;
  session = recordTranscriptionCompleted(
    session,
    { id: transcriptionId, recordingId: `${input.sessionId}-recording`, producedAt: at(52) },
    metadata(at(52), 'transcription')
  ).session;

  const draftCreatedAt = at(55);
  const record = createClinicalRecordDraft(
    {
      id: input.recordId, revisionId: `${input.recordId}-rev-1`, organizationId: input.organizationId,
      patientId: input.patientId, sessionId: input.sessionId,
      responsibleProfessionalId: input.professionalId, assignedProfessionalIds: [input.professionalId],
      source: 'ai_assisted',
      content: {
        subjective: 'Paciente relata semana com oscilações de ansiedade ligadas à rotina de trabalho e dificuldade para desacelerar à noite.',
        objective: 'Apresentou-se orientada, colaborativa, com discurso organizado e afeto congruente ao relato.',
        assessment: 'Evolução consistente com o plano em curso. Estratégias de regulação aplicadas fora da sessão com adesão parcial.',
        plan: 'Manter registro diário de gatilhos e ampliar prática de respiração diafragmática antes de dormir.',
        extractedTasks: [
          'Registrar três momentos positivos do dia',
          'Praticar respiração diafragmática por cinco minutos antes de dormir',
        ],
      },
      aiProvenance: {
        provider: 'demo', model: 'demo-soap', promptVersion: '2026-07', transcriptionId, generatedAt: at(53),
      },
      retentionUntil: new Date(Date.parse(input.scheduledStart) + 5 * 365 * 24 * 60 * 60 * 1000).toISOString(),
      createdAt: draftCreatedAt,
    },
    metadata(draftCreatedAt, 'draft')
  ).record;

  session = markClinicalDraftReady(session, record.id, metadata(at(56), 'draft-ready')).session;
  return { session, record };
}
