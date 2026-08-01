import { resolveRequestContext } from '@/server/application/context';
import { failure, success } from '@/server/application/http';
import { getApplicationStore } from '@/server/application/store';
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

    // 2. Busca ou instancia o rascunho de prontuário SOAP
    let record = await store.records.findBySessionId(context.actor.organizationId, sessionId);
    if (!record) {
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
            content: {
              subjective: '[00:15] Paciente: Tenho me sentido bastante sobrecarregado no trabalho nas últimas duas semanas, principalmente após assumir a coordenação de novos projetos.\n[02:40] Paciente: Tentei aplicar as práticas de respiração que conversamos, mas ainda me sinto bastante agitado antes de reuniões importantes.',
              objective: 'Sessão telepresencial realizada via chamada de vídeo Zoom-Like. Duração total: 45 minutos. Paciente manteve bom contato visual e tom de voz calmo, demonstrando clareza ao relatar seus sintomas. Transcrição contínua capturada sem ruídos significativos.',
              assessment: 'Paciente apresenta sintomas característicos de ansiedade ocupacional e sobrecarga de papel. Apresenta boa receptividade a intervenções de TCC, necessitando de fortalecimento em reestruturação cognitiva sobre autoexigência.',
              plan: '1. Manter diário de registro de pensamentos automáticos (RPD).\n2. Realizar 10 minutos de respiração diafragmática ao acordar.\n3. Escrever rascunho de delimitação de demandas para apresentar à gerência.',
              extractedTasks: [
                '📝 Preencher RPD ao perceber gatilhos de ansiedade',
                '🧘 Praticar 10 min de respiração diafragmática ao acordar',
                '✉️ Escrever rascunho de alinhamento de demandas com a gerência',
              ],
            },
            aiProvenance: {
              provider: 'assemblyai',
              model: 'assemblyai-v2',
              promptVersion: 'v1.0',
              transcriptionId: `transcription-${sessionId}`,
              generatedAt: occurredAt,
            },
            createdByUserId: context.actor.userId,
            createdAt: occurredAt,
          },
        ],
        approvals: [],
        activeDraftRevisionNumber: 1,
        retentionUntil: new Date(Date.now() + 90 * 24 * 60 * 60 * 1000).toISOString(),
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

    return success({ sessionId, status: session.status, recordId: record.id });
  } catch (err) {
    return failure(err);
  }
}
