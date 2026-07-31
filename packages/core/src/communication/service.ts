import { markNotificationDelivered, markNotificationFailed, queueNotification, startNotificationDelivery } from './aggregate';
import type { CommunicationAuditPort, NotificationDeliveryPort, NotificationRepository } from './ports';

export async function enqueueNotification(input: Parameters<typeof queueNotification>[0], repository: NotificationRepository, audit: CommunicationAuditPort) {
  const replay = await repository.findByIdempotencyKey(input.organizationId, input.idempotencyKey);
  if (replay) return { message: replay, idempotentReplay: true };
  const message = queueNotification(input);
  await repository.save(message);
  await audit.append({ id: `${message.id}:queued`, organizationId: message.organizationId, patientId: message.patientId, messageId: message.id, action: 'queued', channel: message.channel, category: message.category, occurredAt: message.createdAt });
  return { message, idempotentReplay: false };
}

export async function deliverNotification(input: { organizationId: string; messageId: string; occurredAt: string; repository: NotificationRepository; provider: NotificationDeliveryPort; audit: CommunicationAuditPort }) {
  const message = await input.repository.getById(input.organizationId, input.messageId);
  if (!message) throw new Error('Mensagem não encontrada.');
  if (message.status === 'delivered') return { message, idempotentReplay: true };
  if (input.provider.channel !== message.channel) throw new Error('O adaptador não atende ao canal da mensagem.');
  const sending = startNotificationDelivery(message, input.occurredAt);
  await input.repository.save(sending);
  await input.audit.append({ id: `${sending.id}:${sending.attemptCount}:delivery_started`, organizationId: sending.organizationId, patientId: sending.patientId, messageId: sending.id, action: 'delivery_started', channel: sending.channel, category: sending.category, occurredAt: input.occurredAt });
  try {
    const result = await input.provider.send(sending);
    const delivered = markNotificationDelivered(sending, result.providerMessageId, input.occurredAt);
    await input.repository.save(delivered);
    await input.audit.append({ id: `${delivered.id}:${delivered.attemptCount}:delivered`, organizationId: delivered.organizationId, patientId: delivered.patientId, messageId: delivered.id, action: 'delivered', channel: delivered.channel, category: delivered.category, occurredAt: input.occurredAt });
    return { message: delivered, idempotentReplay: false };
  } catch (error) {
    const code = error instanceof Error ? error.name || 'DELIVERY_ERROR' : 'DELIVERY_ERROR';
    const failed = markNotificationFailed(sending, code, input.occurredAt);
    await input.repository.save(failed);
    await input.audit.append({ id: `${failed.id}:${failed.attemptCount}:failed`, organizationId: failed.organizationId, patientId: failed.patientId, messageId: failed.id, action: 'failed', channel: failed.channel, category: failed.category, occurredAt: input.occurredAt, errorCode: code });
    return { message: failed, idempotentReplay: false };
  }
}
