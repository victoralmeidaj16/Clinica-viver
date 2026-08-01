import {
  deliverNotification,
  enqueueNotification,
  EvolutionWhatsAppDeliveryProvider,
  type NotificationTemplateInput,
} from '@thats-life/core';
import type { RequestContext } from './context';
import { getApplicationStore } from './store';

export async function getCommunicationQueue(context: RequestContext) {
  const store = getApplicationStore();
  const { organizationId } = context.actor;

  const messages = await store.notifications.list({ organizationId });
  const auditEvents = store.communicationAudit.listEvents();

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
  const provider = new EvolutionWhatsAppDeliveryProvider();
  const occurredAt = new Date().toISOString();

  const result = await deliverNotification({
    organizationId: context.actor.organizationId,
    messageId,
    occurredAt,
    repository: store.notifications,
    provider,
    audit: store.communicationAudit,
  });

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
  const messageId = `msg-test-${Date.now()}`;
  const idempotencyKey = `idempotency-comm-${messageId}`;

  const preference = store.preferences.find(
    (p) => p.organizationId === organizationId && p.patientId === input.patientId
  ) || {
    organizationId,
    patientId: input.patientId,
    enabledChannels: ['whatsapp' as const],
    disabledCategories: [],
    updatedAt: occurredAt,
  };

  const consents = store.consents.filter(
    (c) => c.organizationId === organizationId && c.patientId === input.patientId
  );

  const template: NotificationTemplateInput = input.template || {
    category: 'appointment_reminder',
    professionalName: 'Dra. Camila Vasconcelos',
    appointmentLabel: 'Amanhã às 14:00',
  };

  const enqueueResult = await enqueueNotification(
    {
      id: messageId,
      organizationId,
      patientId: input.patientId,
      recipientReference: input.recipientReference || '5511987654321',
      channel: 'whatsapp',
      template,
      preference,
      consents: consents.length > 0 ? consents : [
        {
          id: `consent-${input.patientId}`,
          organizationId,
          patientId: input.patientId,
          channel: 'whatsapp',
          status: 'granted',
          policyVersion: '2026-07',
          capturedAt: occurredAt,
        },
      ],
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
