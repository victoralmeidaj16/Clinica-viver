import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { InMemoryNotificationRepository, InMemoryCommunicationAudit, queueNotification } from '@thats-life/core';
vi.mock('server-only', () => ({}));
const mocks = vi.hoisted(() => ({ getStore: vi.fn(), query: vi.fn() }));
vi.mock('./store', () => ({ getApplicationStore: mocks.getStore, persistApplicationState: vi.fn() }));
vi.mock('@/server/oci/runtime', () => ({ isMysqlConfigured: () => true, getMysqlPool: () => ({ query: mocks.query }) }));
vi.mock('@/server/communication/whatsappDelivery', () => ({ deliverWhatsApp: vi.fn() }));
vi.mock('@/server/adapters/whatsappAllowlist', () => ({ assertWhatsAppRecipientAllowed: vi.fn() }));
import { deliverWhatsApp } from '@/server/communication/whatsappDelivery';
import { dispatchCommunicationMessage, getCommunicationQueue, sendTestNotification } from './communicationService';
import type { RequestContext } from './context';
const context: RequestContext = { actor: { actorType: 'staff', organizationId: 'org', userId: 'user', roles: ['professional'], membershipId: 'member', membershipStatus: 'active', professionalProfileId: 'pro' }, correlationId: 'c' };
const at = '2026-10-22T10:00:00Z';
const preference = { organizationId: 'org', patientId: 'patient', enabledChannels: ['whatsapp' as const], disabledCategories: [], updatedAt: at };
const consent = { id: 'consent', organizationId: 'org', patientId: 'patient', channel: 'whatsapp' as const, status: 'granted' as const, policyVersion: '1', capturedAt: at };
beforeEach(() => {
  vi.clearAllMocks();
  vi.stubEnv('EVOLUTION_API_URL', 'https://provider.invalid');
  vi.stubEnv('EVOLUTION_API_KEY', 'test');
  vi.stubEnv('EVOLUTION_INSTANCE_NAME', 'test');
  const message = queueNotification({ id: 'message', organizationId: 'org', patientId: 'patient', recipientReference: 'contact-patient', channel: 'whatsapp', template: { category: 'billing_due', amountLabel: 'R$ 75', dueLabel: 'amanhã' }, preference, consents: [consent], scheduledFor: at, idempotencyKey: 'key', createdAt: at });
  mocks.getStore.mockReturnValue({ notifications: new InMemoryNotificationRepository([message]), communicationAudit: new InMemoryCommunicationAudit(), preferences: [preference], consents: [consent], identities: { getPatient: async () => ({ id: 'patient', organizationId: 'org', assignedProfessionalIds: ['pro'], status: 'active' }) } });
  mocks.query.mockResolvedValue([[{ telefone: '11999999999' }]]);
  vi.mocked(deliverWhatsApp).mockResolvedValue({ state: 'sent', providerMessageId: 'real-provider-id' });
});
it('despacha ao provedor real com telefone do cadastro e guarda confirmação', async () => {
  const result = await dispatchCommunicationMessage(context, 'message');
  expect(deliverWhatsApp).toHaveBeenCalledWith(expect.objectContaining({ number: '5511999999999' }));
  expect(result.message).toMatchObject({ status: 'delivered', providerMessageId: 'real-provider-id' });
});
it('não marca entregue quando o provedor informa resultado incerto', async () => {
  vi.mocked(deliverWhatsApp).mockResolvedValue({ state: 'unknown' });
  expect((await dispatchCommunicationMessage(context, 'message')).message.status).toBe('failed');
});
it('recupera aceite persistido quando processo parou antes de atualizar a fila', async () => {
  const store = mocks.getStore();
  const message = await store.notifications.getById('org', 'message');
  await store.notifications.save({ ...message, status: 'sending', attemptCount: 1 });
  const result = await dispatchCommunicationMessage(context, 'message');
  expect(result.message).toMatchObject({ status: 'delivered', attemptCount: 1, providerMessageId: 'real-provider-id' });
});
it('mantém envio interrompido pendente quando o aceite permanece incerto', async () => {
  const store = mocks.getStore();
  const message = await store.notifications.getById('org', 'message');
  await store.notifications.save({ ...message, status: 'sending', attemptCount: 1 });
  vi.mocked(deliverWhatsApp).mockResolvedValue({ state: 'unknown' });
  const result = await dispatchCommunicationMessage(context, 'message');
  expect(result.message.status).toBe('sending');
});

afterEach(() => vi.unstubAllEnvs());
it('oculta resumos de pacientes não atribuídos ao profissional', async () => {
  const store = mocks.getStore();
  const message = await store.notifications.getById('org', 'message');
  await store.notifications.save({ ...message, id: 'other', idempotencyKey: 'other', patientId: 'other-patient', category: 'patient_handoff', body: 'Resumo reservado' });
  store.identities.getPatient = async (_org: string, id: string) => ({ id, organizationId: 'org', assignedProfessionalIds: id === 'patient' ? ['pro'] : ['another-pro'], status: 'active' });
  const queue = await getCommunicationQueue(context);
  expect(queue.messages.map((m) => m.id)).toEqual(['message']);
});
it('recusa enfileiramento sem acesso antes de gravar a mensagem', async () => {
  const store = mocks.getStore();
  store.identities.getPatient = async () => ({ id: 'patient', organizationId: 'org', assignedProfessionalIds: ['another-pro'], status: 'active' });
  const before = await store.notifications.list({ organizationId: 'org' });
  await expect(sendTestNotification({ ...context, idempotencyKey: 'unauthorized' }, { patientId: 'patient' })).rejects.toThrow('Acesso negado');
  expect(await store.notifications.list({ organizationId: 'org' })).toEqual(before);
  expect(deliverWhatsApp).not.toHaveBeenCalled();
});
