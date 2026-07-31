export type CommunicationChannel = 'whatsapp' | 'push' | 'email';
export type NotificationCategory =
  | 'appointment_reminder' | 'appointment_changed' | 'task_assigned'
  | 'task_due' | 'billing_due' | 'payment_confirmed' | 'receipt_available';

export interface CommunicationConsent {
  id: string;
  organizationId: string;
  patientId: string;
  channel: CommunicationChannel;
  status: 'granted' | 'revoked';
  policyVersion: string;
  capturedAt: string;
}

export interface CommunicationPreference {
  organizationId: string;
  patientId: string;
  enabledChannels: readonly CommunicationChannel[];
  disabledCategories: readonly NotificationCategory[];
  quietHours?: { startsAtLocalTime: string; endsAtLocalTime: string; timezone: string };
  updatedAt: string;
}

export interface NotificationMessage {
  schemaVersion: 1;
  id: string;
  organizationId: string;
  patientId: string;
  recipientReference: string;
  category: NotificationCategory;
  channel: CommunicationChannel;
  subject?: string;
  body: string;
  status: 'queued' | 'sending' | 'delivered' | 'failed' | 'cancelled';
  scheduledFor: string;
  attemptCount: number;
  maxAttempts: number;
  idempotencyKey: string;
  providerMessageId?: string;
  lastErrorCode?: string;
  createdAt: string;
  updatedAt: string;
}

export type NotificationTemplateInput =
  | { category: 'appointment_reminder'; professionalName: string; appointmentLabel: string }
  | { category: 'appointment_changed'; professionalName: string; appointmentLabel: string }
  | { category: 'task_assigned'; taskTitle: string }
  | { category: 'task_due'; taskTitle: string; dueLabel: string }
  | { category: 'billing_due'; amountLabel: string; dueLabel: string; paymentUrl?: string }
  | { category: 'payment_confirmed'; amountLabel: string }
  | { category: 'receipt_available'; receiptUrl: string };

export interface CommunicationAuditEvent {
  id: string;
  organizationId: string;
  patientId: string;
  messageId: string;
  action: 'queued' | 'delivery_started' | 'delivered' | 'failed' | 'cancelled';
  channel: CommunicationChannel;
  category: NotificationCategory;
  occurredAt: string;
  errorCode?: string;
}
