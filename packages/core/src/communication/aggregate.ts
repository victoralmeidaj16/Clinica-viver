import { renderNotificationTemplate } from './templates';
import type { CommunicationConsent, CommunicationPreference, NotificationMessage, NotificationTemplateInput } from './types';

const text = (value: string, field: string) => { const normalized = value.trim(); if (!normalized) throw new Error(`${field} é obrigatório.`); return normalized; };
const iso = (value: string, field: string) => { if (Number.isNaN(Date.parse(value))) throw new Error(`${field} deve ser uma data ISO válida.`); return value; };

export function queueNotification(input: {
  id: string; organizationId: string; patientId: string; recipientReference: string;
  channel: NotificationMessage['channel']; template: NotificationTemplateInput;
  preference: CommunicationPreference; consents: readonly CommunicationConsent[];
  scheduledFor: string; idempotencyKey: string; createdAt: string; maxAttempts?: number;
}): NotificationMessage {
  if (input.preference.organizationId !== input.organizationId || input.preference.patientId !== input.patientId) throw new Error('As preferências não pertencem ao paciente.');
  if (!input.preference.enabledChannels.includes(input.channel)) throw new Error('O canal está desabilitado nas preferências do paciente.');
  if (input.preference.disabledCategories.includes(input.template.category)) throw new Error('A categoria está desabilitada nas preferências do paciente.');
  const latestConsent = input.consents.filter((item) => item.organizationId === input.organizationId && item.patientId === input.patientId && item.channel === input.channel).sort((a, b) => b.capturedAt.localeCompare(a.capturedAt))[0];
  if (latestConsent?.status !== 'granted') throw new Error('Consentimento ativo para o canal é obrigatório.');
  const createdAt = iso(input.createdAt, 'createdAt');
  const scheduledFor = iso(input.scheduledFor, 'scheduledFor');
  const rendered = renderNotificationTemplate(input.template);
  const maxAttempts = input.maxAttempts ?? 3;
  if (!Number.isInteger(maxAttempts) || maxAttempts < 1) throw new Error('maxAttempts deve ser positivo.');
  return { schemaVersion: 1, id: text(input.id, 'id'), organizationId: text(input.organizationId, 'organizationId'), patientId: text(input.patientId, 'patientId'), recipientReference: text(input.recipientReference, 'recipientReference'), category: input.template.category, channel: input.channel, ...rendered, status: 'queued', scheduledFor, attemptCount: 0, maxAttempts, idempotencyKey: text(input.idempotencyKey, 'idempotencyKey'), createdAt, updatedAt: createdAt };
}

export function startNotificationDelivery(message: NotificationMessage, occurredAt: string): NotificationMessage {
  if (!['queued', 'failed'].includes(message.status) || message.attemptCount >= message.maxAttempts) throw new Error('A mensagem não está disponível para entrega.');
  return { ...message, status: 'sending', attemptCount: message.attemptCount + 1, lastErrorCode: undefined, updatedAt: iso(occurredAt, 'occurredAt') };
}

export function markNotificationDelivered(message: NotificationMessage, providerMessageId: string, occurredAt: string): NotificationMessage {
  if (message.status !== 'sending') throw new Error('Somente uma mensagem em envio pode ser entregue.');
  return { ...message, status: 'delivered', providerMessageId: text(providerMessageId, 'providerMessageId'), updatedAt: iso(occurredAt, 'occurredAt') };
}

export function markNotificationFailed(message: NotificationMessage, errorCode: string, occurredAt: string): NotificationMessage {
  if (message.status !== 'sending') throw new Error('Somente uma mensagem em envio pode falhar.');
  return { ...message, status: 'failed', lastErrorCode: text(errorCode, 'errorCode'), updatedAt: iso(occurredAt, 'occurredAt') };
}

export function cancelNotification(message: NotificationMessage, occurredAt: string): NotificationMessage {
  if (['delivered', 'cancelled'].includes(message.status)) throw new Error('A mensagem não pode ser cancelada.');
  return { ...message, status: 'cancelled', updatedAt: iso(occurredAt, 'occurredAt') };
}
