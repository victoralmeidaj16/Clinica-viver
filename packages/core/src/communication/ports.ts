import type { CommunicationAuditEvent, CommunicationConsent, CommunicationPreference, NotificationMessage } from './types';

export interface NotificationRepository {
  getById(organizationId: string, messageId: string): Promise<NotificationMessage | null>;
  findByIdempotencyKey(organizationId: string, key: string): Promise<NotificationMessage | null>;
  listDue(before: string, limit: number): Promise<readonly NotificationMessage[]>;
  list(filter: { organizationId: string; patientId?: string }): Promise<readonly NotificationMessage[]>;
  save(message: NotificationMessage): Promise<void>;
}
export interface CommunicationPreferenceRepository {
  getPreference(organizationId: string, patientId: string): Promise<CommunicationPreference | null>;
  listConsents(organizationId: string, patientId: string): Promise<readonly CommunicationConsent[]>;
}
export interface NotificationDeliveryPort {
  readonly channel: NotificationMessage['channel'];
  send(message: NotificationMessage): Promise<{ providerMessageId: string }>;
}
export interface CommunicationAuditPort { append(event: CommunicationAuditEvent): Promise<void>; }
