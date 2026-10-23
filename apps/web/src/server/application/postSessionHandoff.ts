import {
  approvePatientHandoff, createPatientHandoffDraft, enqueueNotification,
  hasActiveConsent, markPatientHandoffDelivered, type PatientHandoff,
} from '@thats-life/core';
import { getHandoff, saveHandoff } from '@/server/communication/handoffRepository';
import type { RequestContext } from './context';
import type { PostSessionInput } from './postSessionService';
import { dispatchCommunicationMessage } from './communicationService';
import { getApplicationStore, persistApplicationState } from './store';

export async function deliverPostSessionHandoff(
  context: RequestContext, sessionId: string, input: PostSessionInput
): Promise<PatientHandoff> {
  const store = getApplicationStore();
  const organizationId = context.actor.organizationId;
  const session = await store.sessions.getById(organizationId, sessionId);
  if (!session) throw new Error('Sessão clínica não encontrada.');
  if (!session.automationPlan.patientHandoff || !hasActiveConsent(session, 'patient_handoff')) {
    throw new Error('Entrega ao paciente exige autorização e consentimento da sessão.');
  }
  const professional = await store.identities.getProfessional(organizationId, session.primaryProfessionalId);
  if (!professional) throw new Error('Profissional responsável não encontrado.');

  const draft = createPatientHandoffDraft({
    patientId: session.patientId, sessionId, summary: input.handoff.summary,
    tasks: input.handoff.tasks, nextSessionLabel: input.handoff.nextSessionLabel,
    professionalName: professional.displayName,
  });
  const existing = await getHandoff(organizationId, sessionId);
  if (existing && (
    existing.patientId !== draft.patientId || existing.summary !== draft.summary ||
    existing.nextSessionLabel !== draft.nextSessionLabel ||
    JSON.stringify(existing.tasks.map((task) => task.title)) !== JSON.stringify(draft.tasks.map((task) => task.title))
  )) {
    throw new Error('A entrega desta sessão já foi aprovada com outro conteúdo.');
  }
  if (existing?.status === 'delivered') return existing;

  const preference = store.preferences.find(
    (item) => item.organizationId === organizationId && item.patientId === session.patientId
  );
  if (!preference) throw new Error('Preferências de comunicação não encontradas.');
  const approved = await saveHandoff(organizationId,
    existing ?? approvePatientHandoff(draft, context.actor.userId, input.occurredAt)
  );
  if (approved.status === 'delivered') return approved;
  const notification = await enqueueNotification({
    id: `notification-${sessionId}-handoff`, organizationId, patientId: session.patientId,
    recipientReference: `contact-${session.patientId}`, channel: 'whatsapp',
    template: {
      category: 'patient_handoff', summary: approved.summary,
      tasks: approved.tasks.map((task) => task.title), professionalName: approved.professionalName,
      nextSessionLabel: approved.nextSessionLabel,
    },
    preference, consents: store.consents, scheduledFor: input.occurredAt,
    idempotencyKey: `session:${sessionId}:patient-handoff`, createdAt: input.occurredAt,
  }, store.notifications, store.communicationAudit);
  await persistApplicationState();
  const delivery = await dispatchCommunicationMessage(context, notification.message.id);
  if (delivery.message.status !== 'delivered') {
    throw new Error('A entrega ao paciente ainda não foi confirmada pelo provedor.');
  }
  return saveHandoff(organizationId, markPatientHandoffDelivered(approved, new Date().toISOString()));
}
