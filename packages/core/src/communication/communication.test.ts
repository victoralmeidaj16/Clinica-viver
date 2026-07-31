import { describe, expect, it } from 'vitest';
import { InMemoryCommunicationAudit, InMemoryNotificationRepository, deliverNotification, enqueueNotification, markNotificationFailed, queueNotification, renderNotificationTemplate, startNotificationDelivery, type CommunicationConsent, type CommunicationPreference, type NotificationDeliveryPort } from './index';

const preference: CommunicationPreference = { organizationId: 'org-1', patientId: 'patient-1', enabledChannels: ['whatsapp', 'push'], disabledCategories: [], updatedAt: '2026-08-01T10:00:00.000Z' };
const consent: CommunicationConsent = { id: 'consent-1', organizationId: 'org-1', patientId: 'patient-1', channel: 'whatsapp', status: 'granted', policyVersion: '2026-08', capturedAt: '2026-08-01T10:00:00.000Z' };

function message() { return queueNotification({ id: 'message-1', organizationId: 'org-1', patientId: 'patient-1', recipientReference: 'contact-1', channel: 'whatsapp', template: { category: 'appointment_reminder', professionalName: 'Dra. Camila', appointmentLabel: '03/08 às 09h' }, preference, consents: [consent], scheduledFor: '2026-08-03T11:00:00.000Z', idempotencyKey: 'appointment-1:reminder-60', createdAt: '2026-08-01T10:00:00.000Z' }); }

describe('communication and notifications', () => {
  it('respeita consentimento, preferência e templates sem conteúdo clínico', () => {
    expect(message()).toMatchObject({ status: 'queued', attemptCount: 0, category: 'appointment_reminder' });
    expect(() => queueNotification({ id: 'message-2', organizationId: 'org-1', patientId: 'patient-1', recipientReference: 'contact-1', channel: 'email', template: { category: 'payment_confirmed', amountLabel: 'R$ 250,00' }, preference, consents: [consent], scheduledFor: '2026-08-01T10:00:00.000Z', idempotencyKey: 'payment-1', createdAt: '2026-08-01T10:00:00.000Z' })).toThrow('desabilitado');
    expect(() => renderNotificationTemplate({ category: 'task_assigned', taskTitle: 'Revisar diagnóstico no prontuário SOAP' })).toThrow('conteúdo clínico restrito');
  });

  it('controla tentativas e bloqueia após atingir o limite', () => {
    let current = message();
    for (let attempt = 0; attempt < 3; attempt += 1) { current = startNotificationDelivery(current, `2026-08-03T11:0${attempt}:00.000Z`); current = markNotificationFailed(current, 'TIMEOUT', `2026-08-03T11:0${attempt}:30.000Z`); }
    expect(current.attemptCount).toBe(3);
    expect(() => startNotificationDelivery(current, '2026-08-03T11:04:00.000Z')).toThrow('não está disponível');
  });

  it('entrega pelo adaptador correto e trata repetição como idempotente', async () => {
    const repository = new InMemoryNotificationRepository(); const audit = new InMemoryCommunicationAudit(); await repository.save(message());
    const provider: NotificationDeliveryPort = { channel: 'whatsapp', send: async () => ({ providerMessageId: 'evolution-message-1' }) };
    const first = await deliverNotification({ organizationId: 'org-1', messageId: 'message-1', occurredAt: '2026-08-03T11:00:00.000Z', repository, provider, audit });
    const replay = await deliverNotification({ organizationId: 'org-1', messageId: 'message-1', occurredAt: '2026-08-03T11:01:00.000Z', repository, provider, audit });
    expect(first.message.status).toBe('delivered'); expect(replay.idempotentReplay).toBe(true); expect(audit.listEvents()).toHaveLength(2); expect(audit.listEvents()[0]).not.toHaveProperty('body');
  });

  it('inclui na fila uma única vez pela chave de idempotência', async () => {
    const repository = new InMemoryNotificationRepository(); const audit = new InMemoryCommunicationAudit();
    const input = { id: 'message-1', organizationId: 'org-1', patientId: 'patient-1', recipientReference: 'contact-1', channel: 'whatsapp' as const, template: { category: 'payment_confirmed' as const, amountLabel: 'R$ 250,00' }, preference, consents: [consent], scheduledFor: '2026-08-01T10:00:00.000Z', idempotencyKey: 'payment-confirmed-1', createdAt: '2026-08-01T10:00:00.000Z' };
    const first = await enqueueNotification(input, repository, audit); const replay = await enqueueNotification(input, repository, audit);
    expect(first.idempotentReplay).toBe(false); expect(replay.idempotentReplay).toBe(true); expect(audit.listEvents()).toHaveLength(1);
  });

  it('registra falha sem gravar o corpo da mensagem na auditoria', async () => {
    const repository = new InMemoryNotificationRepository(); const audit = new InMemoryCommunicationAudit(); await repository.save(message());
    const provider: NotificationDeliveryPort = { channel: 'whatsapp', send: async () => { throw new Error('offline'); } };
    const result = await deliverNotification({ organizationId: 'org-1', messageId: 'message-1', occurredAt: '2026-08-03T11:00:00.000Z', repository, provider, audit });
    expect(result.message).toMatchObject({ status: 'failed', attemptCount: 1 }); expect(JSON.stringify(audit.listEvents())).not.toContain('Lembramos sua sessão');
  });
});
