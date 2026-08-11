import { resolveRequestContext } from '@/server/application/context';
import { ApplicationError, failure, readJson, success } from '@/server/application/http';
import { getApplicationStore, persistApplicationState } from '@/server/application/store';
import { CLINICAL_RECORD_RETENTION } from '@/server/application/retention';
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
    const context = await resolveRequestContext(request, true);
    const { id: sessionId } = await params;
    const store = getApplicationStore();
    const body = await readJson(request);
    const synthesis = String(body.synthesis ?? '').trim();
    if (!synthesis || synthesis.length > 20_000) {
      throw new ApplicationError(
        'INVALID_SYNTHESIS',
        'Informe uma síntese clínica entre 1 e 20.000 caracteres para gerar a minuta SOAP.',
        400
      );
    }

    const occurredAt = new Date().toISOString();
    const professionalId = context.actor.professionalProfileId || 'professional-1';

    // 1. A sessão precisa existir e pertencer ao profissional. Nunca crie uma
    // sessão artificial aqui: isso ligaria uma nota clínica ao paciente errado.
    let session = await store.sessions.getById(context.actor.organizationId, sessionId);
    if (!session) {
      throw new ApplicationError('NOT_FOUND', 'Sessão não encontrada.', 404);
    }
    if (session.primaryProfessionalId !== professionalId) {
      throw new ApplicationError('FORBIDDEN', 'Você não é o profissional responsável por esta sessão.', 403);
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
      const draft = await generateSoapDraft({
        transcriptionId: `session-${sessionId}`,
        transcription: synthesis,
        patientReference: pseudonymizePatient({
          organizationId: context.actor.organizationId,
          patientId: session.patientId,
        }),
      });

      const recordId = `record-${sessionId}`;
      const newRecord: ClinicalRecord = {
        schemaVersion: 1,
        id: recordId,
        organizationId: context.actor.organizationId,
        sessionId,
        patientId: session.patientId,
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
