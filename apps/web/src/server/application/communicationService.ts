import {
  deliverNotification,
  enqueueNotification,
  assertStaffAuthorized,
  authorizeStaff,
  markNotificationDelivered,
  type NotificationTemplateInput,
} from '@thats-life/core';
import type { RequestContext } from './context';
import { getApplicationStore, persistApplicationState } from './store';
import { notificationDeliveryProvider } from '@/server/communication/notificationDelivery';
import { ApplicationError } from './http';
import { deliveryHash } from '@/server/communication/whatsappDeliveryRepository';

export async function getCommunicationQueue(context: RequestContext) {
  const store = getApplicationStore();
  const { organizationId } = context.actor;

  const allMessages = await store.notifications.list({ organizationId });
  const patients = new Map(await Promise.all([...new Set(allMessages.map((m) => m.patientId))]
    .map(async (id) => [id, await store.identities.getPatient(organizationId, id)] as const)));
  const messages = allMessages.filter((message) => {
    const patient = patients.get(message.patientId);
    return patient && authorizeStaff(context.actor,
      message.category === 'patient_handoff' ? 'clinical_sessions.read' : 'patients.read',
      { organizationId, patientId: patient.id, assignedProfessionalIds: patient.assignedProfessionalIds }).allowed;
  });
  const visibleIds = new Set(messages.map((message) => message.id));
  const auditEvents = store.communicationAudit.listEvents().filter((event) =>
    event.organizationId === organizationId && visibleIds.has(event.messageId));

  return {
    organizationId,
    totalMessages: messages.length,
    messages: messages.map((m) => ({
      id: m.id,
      patientId: m.patientId,
      channel: m.channel,
      category: m.category,
      recipientReference: m.recipientReference,
      status: m.status,
      attemptCount: m.attemptCount,
      providerMessageId: m.providerMessageId,
      lastErrorCode: m.lastErrorCode,
      createdAt: m.createdAt,
      updatedAt: m.updatedAt,
      subject: m.subject,
      body: m.body,
    })),
    recentAuditLogs: auditEvents.slice(-10),
  };
}

export async function dispatchCommunicationMessage(
  context: RequestContext,
  messageId: string
) {
  const store = getApplicationStore();
  const occurredAt = new Date().toISOString();

  // O adaptador é escolhido pelo canal da própria mensagem — o core rejeita
  // um provedor que não atenda ao canal, então errar aqui falharia alto.
  const message = await store.notifications.getById(context.actor.organizationId, messageId);
  if (!message) {
    throw new Error('Mensagem não encontrada.');
  }

  const patient = await store.identities.getPatient(context.actor.organizationId, message.patientId);
  if (!patient || patient.status !== 'active') throw new ApplicationError('NOT_FOUND', 'Paciente ativo não encontrado.', 404);
  assertStaffAuthorized(context.actor, message.category === 'patient_handoff' ? 'clinical_sessions.write' : 'patients.write', {
    organizationId: patient.organizationId, patientId: patient.id, assignedProfessionalIds: patient.assignedProfessionalIds,
  });
  if (message.status !== 'delivered') {
    const preference = store.preferences.find((item) => item.organizationId === message.organizationId && item.patientId === message.patientId);
    const consent = store.consents.filter((item) => item.organizationId === message.organizationId
      && item.patientId === message.patientId && item.channel === message.channel)
      .sort((a, b) => b.capturedAt.localeCompare(a.capturedAt))[0];
    if (!preference?.enabledChannels.includes(message.channel) || preference.disabledCategories.includes(message.category)
      || consent?.status !== 'granted') throw new ApplicationError('CONSENT_REQUIRED', 'Canal sem consentimento ativo.', 409);
  }
  const provider = notificationDeliveryProvider(message.channel);

  // O processo pode ter parado entre o aceite do provedor e a atualização da fila.
  // O adaptador consulta a reserva durável; sending/unknown nunca disparam outro HTTP.
  if (message.status === 'sending') {
    let accepted;
    try { accepted = await provider.send(message); }
    catch { return { message, idempotentReplay: true }; }
    const delivered = markNotificationDelivered(message, accepted.providerMessageId, occurredAt);
    await store.notifications.save(delivered);
    await store.communicationAudit.append({ id: `${message.id}:${message.attemptCount}:delivered`,
      organizationId: message.organizationId, patientId: message.patientId, messageId: message.id,
      action: 'delivered', channel: message.channel, category: message.category, occurredAt });
    await persistApplicationState();
    return { message: delivered, idempotentReplay: true };
  }

  const result = await deliverNotification({
    organizationId: context.actor.organizationId,
    messageId,
    occurredAt,
    repository: store.notifications,
    provider,
    audit: store.communicationAudit,
  });

  await persistApplicationState();
  return result;
}

export async function sendTestNotification(
  context: RequestContext,
  input: {
    patientId: string;
    recipientReference?: string;
    template?: NotificationTemplateInput;
  }
) {
  const store = getApplicationStore();
  const { organizationId } = context.actor;
  const occurredAt = new Date().toISOString();
  if (!context.idempotencyKey) throw new ApplicationError('IDEMPOTENCY_REQUIRED', 'Informe Idempotency-Key.', 400);
  const idempotencyKey = `manual:${context.actor.userId}:${context.idempotencyKey}`;
  const messageId = `msg-${deliveryHash(idempotencyKey)}`;

  const preference = store.preferences.find(
    (p) => p.organizationId === organizationId && p.patientId === input.patientId
  );
  if (!preference) throw new ApplicationError('CONSENT_REQUIRED', 'Preferências de comunicação não encontradas.', 409);

  const consents = store.consents.filter(
    (c) => c.organizationId === organizationId && c.patientId === input.patientId
  );

  const patient = await store.identities.getPatient(organizationId, input.patientId);
  if (!patient || patient.status !== 'active') throw new ApplicationError('NOT_FOUND', 'Paciente ativo não encontrado.', 404);
  assertStaffAuthorized(context.actor, 'patients.write', {
    organizationId, patientId: patient.id, assignedProfessionalIds: patient.assignedProfessionalIds,
  });
  const template = input.template;
  if (!template) throw new ApplicationError('INVALID_TEMPLATE', 'Informe o conteúdo da notificação.', 400);
  if (template.category === 'patient_handoff') {
    throw new ApplicationError('HANDOFF_REQUIRES_SESSION', 'Orientações clínicas devem ser aprovadas pelo fluxo pós-sessão.', 400);
  }

  const enqueueResult = await enqueueNotification(
    {
      id: messageId,
      organizationId,
      patientId: input.patientId,
      recipientReference: input.recipientReference || `contact-${input.patientId}`,
      channel: 'whatsapp',
      template,
      preference,
      consents,
      scheduledFor: occurredAt,
      idempotencyKey,
      createdAt: occurredAt,
    },
    store.notifications,
    store.communicationAudit
  );

  const dispatchResult = await dispatchCommunicationMessage(
    context,
    enqueueResult.message.id
  );

  return {
    queued: enqueueResult,
    delivered: dispatchResult,
  };
}
