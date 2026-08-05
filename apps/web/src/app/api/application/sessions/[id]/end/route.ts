import { resolveRequestContext } from '@/server/application/context';
import { failure, success } from '@/server/application/http';
import { getApplicationStore, persistApplicationState } from '@/server/application/store';
import { CLINICAL_RECORD_RETENTION } from '@/server/application/retention';
import { buildDemoTranscription } from '@/server/adapters/transcription';
import { generateSoapDraft } from '@/server/ai/clinicalDraft';
import { pseudonymizePatient } from '@/server/ai/pseudonym';
import type { ClinicalSession, ClinicalRecord } from '@thats-life/core';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const context = await resolveRequestContext(request);
    const { id: sessionId } = await params;
    const store = getApplicationStore();

    const occurredAt = new Date().toISOString();
    const patientId = 'patient-1'; // Mariana Costa
    const professionalId = context.actor.professionalProfileId || 'professional-1';

    // 1. Busca ou instancia a sessão no repositório de memória
    let session = await store.sessions.getById(context.actor.organizationId, sessionId);
    if (!session) {
      session = {
        schemaVersion: 1,
        id: sessionId,
        organizationId: context.actor.organizationId,
        patientId,
        primaryProfessionalId: professionalId,
        assignedProfessionalIds: [professionalId],
        status: 'awaiting_review',
        mode: 'video',
        scheduledStart: occurredAt,
        scheduledEnd: occurredAt,
        consentRecords: [],
        automationPlan: {
          transcription: true,
          patientHandoff: true,
          billing: true,
          receipt: true,
          notification: true,
        },
        automation: {
          transcription: { status: 'completed', attemptCount: 1, updatedAt: occurredAt },
          clinicalDraft: { status: 'requires_review', attemptCount: 1, updatedAt: occurredAt },
          patientHandoff: { status: 'idle', attemptCount: 0, updatedAt: occurredAt },
          billing: { status: 'idle', attemptCount: 0, updatedAt: occurredAt },
          receipt: { status: 'idle', attemptCount: 0, updatedAt: occurredAt },
          notification: { status: 'idle', attemptCount: 0, updatedAt: occurredAt },
        },
        artifacts: {},
        version: 1,
        createdAt: occurredAt,
        updatedAt: occurredAt,
      };
      await store.sessions.commit({
        session,
        expectedVersion: 0,
        commandId: `cmd-session-create-${sessionId}`,
        events: [],
      });
    } else if (session.status !== 'awaiting_review') {
      const updatedSession: ClinicalSession = {
        ...session,
        status: 'awaiting_review',
        version: session.version + 1,
        updatedAt: occurredAt,
      };
      await store.sessions.commit({
        session: updatedSession,
        expectedVersion: session.version,
        commandId: `cmd-session-end-${sessionId}-${Date.now()}`,
        events: [],
      });
      session = updatedSession;
    }

    // 2. Busca ou gera o rascunho de prontuário SOAP.
    //    O rascunho é produzido pela IA a partir da transcrição diarizada; o
    //    paciente é identificado por pseudônimo, e nada aqui conclui a sessão:
    //    o resultado nasce como rascunho e exige aprovação humana.
    let record = await store.records.findBySessionId(context.actor.organizationId, sessionId);
    if (!record) {
      const transcription = buildDemoTranscription({
        organizationId: context.actor.organizationId,
        sessionId,
        patientId,
        producedAt: occurredAt,
      });

      const draft = await generateSoapDraft({
        transcriptionId: transcription.id,
        patientReference: pseudonymizePatient({
          organizationId: context.actor.organizationId,
          patientId,
        }),
      });

      const recordId = `record-${sessionId}`;
      const newRecord: ClinicalRecord = {
        schemaVersion: 1,
        id: recordId,
        organizationId: context.actor.organizationId,
        sessionId,
        patientId,
        responsibleProfessionalId: professionalId,
        assignedProfessionalIds: [professionalId],
        status: 'draft',
        revisions: [
          {
            id: `rev-1-${sessionId}`,
            revisionNumber: 1,
            kind: 'initial',
            source: 'ai_assisted',
            content: draft.content,
            aiProvenance: draft.provenance,
            createdByUserId: context.actor.userId,
            createdAt: occurredAt,
          },
        ],
        approvals: [],
        activeDraftRevisionNumber: 1,
        retentionUntil: CLINICAL_RECORD_RETENTION.until(occurredAt),
        legalHold: false,
        version: 1,
        createdAt: occurredAt,
        updatedAt: occurredAt,
      };

      await store.records.commit({
        record: newRecord,
        expectedVersion: 0,
        commandId: `cmd-record-create-${sessionId}`,
        events: [],
      });
      record = newRecord;
    }

    await persistApplicationState();
    return success({ sessionId, status: session.status, recordId: record.id });
  } catch (err) {
    return failure(err);
  }
}
