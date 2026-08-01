import { describe, expect, it } from 'vitest';
import {
  deliverNotification,
  enqueueNotification,
  EvolutionWhatsAppDeliveryProvider,
  InMemoryCommunicationAudit,
  InMemoryNotificationRepository,
  type CommunicationConsent,
  type CommunicationPreference,
} from './index';

describe('Simulador da Fila de Comunicação & Evolution API WhatsApp', () => {
  const organizationId = 'org-demo';
  const patientId = 'patient-1';
  const messageId = 'msg-comm-test-1';
  const idempotencyKey = 'idemp-comm-test-1';
  const createdAt = '2026-07-31T12:00:00.000Z';

  const preference: CommunicationPreference = {
    organizationId,
    patientId,
    enabledChannels: ['whatsapp'],
    disabledCategories: [],
    updatedAt: createdAt,
  };

  const consents: CommunicationConsent[] = [
    {
      id: 'consent-1',
      organizationId,
      patientId,
      channel: 'whatsapp',
      status: 'granted',
      policyVersion: '2026-07',
      capturedAt: createdAt,
    },
  ];

  it('enfileira uma mensagem transacional com controle de idempotência', async () => {
    const repository = new InMemoryNotificationRepository();
    const audit = new InMemoryCommunicationAudit();

    const result1 = await enqueueNotification(
      {
        id: messageId,
        organizationId,
        patientId,
        recipientReference: '5511987654321',
        channel: 'whatsapp',
        template: {
          category: 'appointment_reminder',
          professionalName: 'Dra. Camila',
          appointmentLabel: 'Amanhã às 14:00',
        },
        preference,
        consents,
        scheduledFor: createdAt,
        idempotencyKey,
        createdAt,
      },
      repository,
      audit
    );

    expect(result1.idempotentReplay).toBe(false);
    expect(result1.message.status).toBe('queued');

    const result2 = await enqueueNotification(
      {
        id: messageId,
        organizationId,
        patientId,
        recipientReference: '5511987654321',
        channel: 'whatsapp',
        template: {
          category: 'appointment_reminder',
          professionalName: 'Dra. Camila',
          appointmentLabel: 'Amanhã às 14:00',
        },
        preference,
        consents,
        scheduledFor: createdAt,
        idempotencyKey,
        createdAt,
      },
      repository,
      audit
    );

    expect(result2.idempotentReplay).toBe(true);
  });

  it('entrega a notificação utilizando o EvolutionWhatsAppDeliveryProvider com log de auditoria', async () => {
    const repository = new InMemoryNotificationRepository();
    const audit = new InMemoryCommunicationAudit();
    const provider = new EvolutionWhatsAppDeliveryProvider();

    await enqueueNotification(
      {
        id: messageId,
        organizationId,
        patientId,
        recipientReference: '5511987654321',
        channel: 'whatsapp',
        template: {
          category: 'billing_due',
          amountLabel: 'R$ 250,00',
          dueLabel: '07/08/2026',
        },
        preference,
        consents,
        scheduledFor: createdAt,
        idempotencyKey,
        createdAt,
      },
      repository,
      audit
    );

    const deliveryResult = await deliverNotification({
      organizationId,
      messageId,
      occurredAt: createdAt,
      repository,
      provider,
      audit,
    });

    expect(deliveryResult.message.status).toBe('delivered');
    expect(deliveryResult.message.providerMessageId).toContain('msg_');

    const auditEvents = audit.listEvents();
    expect(auditEvents.map((e) => e.action)).toContain('delivered');
  });
});
