import type { CommunicationAuditPort, NotificationRepository } from './ports';
import type { CommunicationAuditEvent, NotificationMessage } from './types';

const clone = <T>(value: T): T => structuredClone(value);
const key = (organizationId: string, value: string) => `${organizationId}:${value}`;

export class InMemoryNotificationRepository implements NotificationRepository {
  private readonly messages = new Map<string, NotificationMessage>();

  constructor(seed: readonly NotificationMessage[] = []) {
    seed.forEach((msg) => this.messages.set(key(msg.organizationId, msg.id), clone(msg)));
  }

  async getById(organizationId: string, messageId: string) {
    const item = this.messages.get(key(organizationId, messageId));
    return item ? clone(item) : null;
  }

  async findByIdempotencyKey(organizationId: string, idempotencyKey: string) {
    const item = Array.from(this.messages.values()).find(
      (message) => message.organizationId === organizationId && message.idempotencyKey === idempotencyKey
    );
    return item ? clone(item) : null;
  }

  async listDue(before: string, limit: number) {
    return Array.from(this.messages.values())
      .filter(
        (message) =>
          ['queued', 'failed'].includes(message.status) &&
          Date.parse(message.scheduledFor) <= Date.parse(before) &&
          message.attemptCount < message.maxAttempts
      )
      .sort((a, b) => a.scheduledFor.localeCompare(b.scheduledFor))
      .slice(0, limit)
      .map(clone);
  }

  async list(filter: { organizationId: string; patientId?: string }) {
    return Array.from(this.messages.values())
      .filter(
        (message) =>
          message.organizationId === filter.organizationId &&
          (!filter.patientId || message.patientId === filter.patientId)
      )
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
      .map(clone);
  }

  async save(message: NotificationMessage) {
    const duplicate = await this.findByIdempotencyKey(
      message.organizationId,
      message.idempotencyKey
    );
    if (duplicate && duplicate.id !== message.id)
      throw new Error('Chave de idempotência já utilizada.');
    this.messages.set(key(message.organizationId, message.id), clone(message));
  }
}

export class InMemoryCommunicationAudit implements CommunicationAuditPort {
  private readonly events: CommunicationAuditEvent[] = [];
  async append(event: CommunicationAuditEvent) {
    if (this.events.some((item) => item.id === event.id)) return;
    this.events.push(clone(event));
  }
  listEvents() {
    return clone(this.events);
  }
}
