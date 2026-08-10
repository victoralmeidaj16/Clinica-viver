import {
  approveClinicalRecordRevisionCommand, approvePatientHandoff, assertStaffAuthorized,
  approveClinicalRecordCommand, completeClinicalSessionCommand,
  computeSoapContentHash, createFinancialCharge, createPatientHandoffDraft,
  enqueueNotification, linkDeliveredPatientHandoffCommand, linkSessionChargeCommand,
  markPatientHandoffDelivered, markSessionAutomationFailedCommand,
  markSessionNotificationSentCommand, markSessionReceiptIssuedCommand,
  projectApprovedClinicalRecord, reviewPatientHandoffContent,
  type AutomationStepName, type ClinicalSession, type PatientHandoff,
  type SoapClinicalContent,
} from '@thats-life/core';
import type { RequestContext } from './context';
import { ApplicationError } from './http';
import { getApplicationStore, persistApplicationState } from './store';

export interface PostSessionInput {
  content: SoapClinicalContent;
  handoff: { summary: string; tasks: readonly string[]; nextSessionLabel?: string };
  shareWithPatient: boolean;
  charge: { amountCents: number; dueAt: string };
  notifyPatient: boolean;
  occurredAt: string;
}

export interface PostSessionResult {
  sessionId: string;
  status: ClinicalSession['status'];
  completed: boolean;
  recordId: string;
  approvedRevisionNumber?: number;
  contentHashSha256: string;
  timelineEntries: number;
  handoffTasks: number;
  chargeId?: string;
  receiptId?: string;
  notificationId?: string;
  failedStep?: { step: AutomationStepName; errorCode: string; message: string };
}

const CENTS_IN_REAL = 100;

/**
 * Sessões encerradas que ainda dependem da revisão humana. É a fila de entrada
 * do cockpit: o rascunho existe, mas nada foi aprovado nem enviado.
 */
export async function listSessionsForReview(context: RequestContext) {
  const store = getApplicationStore();
  assertStaffAuthorized(context.actor, 'clinical_sessions.read', {
    organizationId: context.actor.organizationId,
  });
  const sessions = await store.sessions.list({
    organizationId: context.actor.organizationId,
    professionalId: context.actor.professionalProfileId,
    statuses: ['awaiting_review', 'ready_to_complete'],
  });
  return Promise.all(
    sessions.map(async (session) => {
      const record = await store.records.findBySessionId(session.organizationId, session.id);
      const patient = await store.identities.getPatient(session.organizationId, session.patientId);
      const draft = record?.activeDraftRevisionNumber
        ? record.revisions.find((item) => item.revisionNumber === record.activeDraftRevisionNumber)
        : undefined;
      return {
        sessionId: session.id, status: session.status, patientId: session.patientId,
        patientName: patient?.displayName ?? session.patientId,
        scheduledStart: session.scheduledStart, automation: session.automation,
        recordId: record?.id, draftContent: draft?.content,
      };
    })
  );
}

function money(amountCents: number): string {
  return (amountCents / CENTS_IN_REAL).toLocaleString('pt-BR', {
    style: 'currency', currency: 'BRL',
  });
}

function day(value: string): string {
  return new Date(value).toLocaleDateString('pt-BR', { timeZone: 'America/Sao_Paulo' });
}

/**
 * Automação pós-sessão em 1 clique.
 *
 * A aprovação do prontuário é o ponto sem volta: uma vez aprovada e projetada
 * na linha do tempo, ela não é desfeita se uma etapa posterior falhar. Entrega
 * ao paciente, cobrança, recibo e notificação são etapas opcionais e sequenciais
 * — a primeira falha é registrada no agregado da sessão, interrompe a cadeia e
 * devolve um resultado parcial. A sessão permanece em `ready_to_complete` e o
 * profissional pode repetir apenas o que faltou, sem duplicar o que já ocorreu.
 *
 * Cada etapa recebe um `commandId` derivado da `Idempotency-Key` da requisição,
 * portanto reenviar o mesmo comando reproduz o resultado em vez de gerar uma
 * segunda cobrança ou uma segunda mensagem.
 */
export async function runPostSessionAutomation(
  context: RequestContext,
  sessionId: string,
  input: PostSessionInput
): Promise<PostSessionResult> {
  const store = getApplicationStore();
  const key = context.idempotencyKey!;
  const metadata = (suffix: string) => ({
    actorUserId: context.actor.userId, occurredAt: input.occurredAt,
    correlationId: context.correlationId, commandId: `${key}:${suffix}`,
  });

  const record = await store.records.findBySessionId(context.actor.organizationId, sessionId);
  if (!record) throw new ApplicationError('NOT_FOUND', 'A sessão não possui prontuário para aprovar.', 404);
  if (!context.actor.professionalProfileId) {
    throw new ApplicationError('FORBIDDEN', 'O usuário não representa um profissional.', 403);
  }

  // A entrega ao paciente é validada antes de qualquer escrita: rejeitar cedo
  // evita aprovar o prontuário e só então descobrir que o resumo é impróprio.
  const warnings = input.shareWithPatient
    ? reviewPatientHandoffContent(input.handoff.summary, input.handoff.tasks)
    : [];
  if (warnings.length > 0) {
    throw new ApplicationError('HANDOFF_REVIEW_REQUIRED', warnings.join(' '), 422);
  }

  const contentHashSha256 = await computeSoapContentHash(input.content);
  const dependencies = { records: store.records, sessions: store.sessions };
  const approved = await approveClinicalRecordRevisionCommand(
    dependencies, context.actor, record.id,
    { professionalId: context.actor.professionalProfileId, contentHashSha256, approvalId: `${key}:approval` },
    metadata('record')
  );
  await approveClinicalRecordCommand(
    { sessions: store.sessions, identities: store.identities },
    context.actor, sessionId, approved.record.id, metadata('session-approve')
  );

  const entries = projectApprovedClinicalRecord(approved.record);
  await store.timeline.upsert(entries);

  const result: PostSessionResult = {
    sessionId, status: 'ready_to_complete', completed: false, recordId: approved.record.id,
    approvedRevisionNumber: approved.record.currentApprovedRevisionNumber,
    contentHashSha256, timelineEntries: entries.length, handoffTasks: 0,
  };

  const sessionDependencies = { sessions: store.sessions, identities: store.identities };
  const fail = async (step: AutomationStepName, error: unknown): Promise<PostSessionResult> => {
    const message = error instanceof Error ? error.message : 'Falha desconhecida.';
    const errorCode = `${step.toLocaleUpperCase('en-US')}_FAILED`;
    const failed = await markSessionAutomationFailedCommand(
      sessionDependencies, context.actor, sessionId, step, errorCode, metadata(`${step}-failed`)
    );
    await persistApplicationState();
    return { ...result, status: failed.session.status, failedStep: { step, errorCode, message } };
  };

  if (input.shareWithPatient) {
    try {
      const delivered = await deliverHandoff(context, sessionId, input, key);
      await linkDeliveredPatientHandoffCommand(
        sessionDependencies, context.actor, sessionId, delivered, metadata('handoff')
      );
      result.handoffTasks = delivered.tasks.length;
    } catch (error) {
      return fail('patient_handoff', error);
    }
  }

  let charge;
  try {
    charge = createFinancialCharge({
      id: `charge-${sessionId}`, organizationId: context.actor.organizationId, sessionId,
      patientId: approved.record.patientId, professionalId: approved.record.responsibleProfessionalId,
      issuedAt: input.occurredAt, dueAt: input.charge.dueAt, amountCents: input.charge.amountCents,
      description: 'Sessão de psicoterapia', createdAt: input.occurredAt,
    });
    await store.financial.saveCharge(charge);
    await linkSessionChargeCommand(
      sessionDependencies, context.actor, sessionId, charge, metadata('billing')
    );
    result.chargeId = charge.id;
  } catch (error) {
    return fail('billing', error);
  }

  try {
    const receiptId = `receipt-${sessionId}`;
    await markSessionReceiptIssuedCommand(
      sessionDependencies, context.actor, sessionId, receiptId, metadata('receipt')
    );
    result.receiptId = receiptId;
  } catch (error) {
    return fail('receipt', error);
  }

  if (input.notifyPatient) {
    try {
      const preference = store.preferences.find(
        (item) => item.organizationId === context.actor.organizationId && item.patientId === approved.record.patientId
      );
      if (!preference) throw new Error('Preferências de comunicação não encontradas.');
      const notification = await enqueueNotification(
        {
          id: `notification-${sessionId}-billing`, organizationId: context.actor.organizationId,
          patientId: approved.record.patientId, recipientReference: `contact-${approved.record.patientId}`,
          channel: 'whatsapp',
          template: { category: 'billing_due', amountLabel: money(charge.amountCents), dueLabel: day(charge.dueAt) },
          preference, consents: store.consents, scheduledFor: input.occurredAt,
          idempotencyKey: `${key}:notification`, createdAt: input.occurredAt,
        },
        store.notifications, store.communicationAudit
      );
      await markSessionNotificationSentCommand(
        sessionDependencies, context.actor, sessionId, notification.message.id, metadata('notification-sent')
      );
      result.notificationId = notification.message.id;
    } catch (error) {
      return fail('notification', error);
    }
  }

  const completed = await completeClinicalSessionCommand(
    sessionDependencies, context.actor, sessionId, metadata('complete')
  );
  await persistApplicationState();
  return { ...result, status: completed.session.status, completed: completed.session.status === 'completed' };
}

/**
 * Monta a entrega do paciente e registra as tarefas no care plan. O conteúdo
 * segue o contrato separado: apenas resumo e tarefas revisados, nunca SOAP,
 * transcrição ou hipótese diagnóstica.
 */
async function deliverHandoff(
  context: RequestContext, sessionId: string, input: PostSessionInput, key: string
): Promise<PatientHandoff> {
  const store = getApplicationStore();
  const session = await store.sessions.getById(context.actor.organizationId, sessionId);
  if (!session) throw new Error('Sessão clínica não encontrada.');
  const professional = await store.identities.getProfessional(
    context.actor.organizationId, session.primaryProfessionalId
  );
  if (!professional) throw new Error('Profissional responsável não encontrado.');

  const draft = createPatientHandoffDraft({
    patientId: session.patientId, sessionId, summary: input.handoff.summary,
    tasks: input.handoff.tasks, nextSessionLabel: input.handoff.nextSessionLabel,
    professionalName: professional.displayName,
  });
  const delivered = markPatientHandoffDelivered(
    approvePatientHandoff(draft, context.actor.userId, input.occurredAt), input.occurredAt
  );

  return delivered;
}
