import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  createClinicalRecordDraft, createFinancialCharge, scheduleClinicalSession,
  InMemoryClinicalRecordRepository, InMemoryClinicalSessionRepository,
  InMemoryClinicalTimelineRepository, InMemoryFinancialRepository,
} from '@thats-life/core';
import type { RequestContext } from './context';
import type { getApplicationStore } from './store';
vi.mock('server-only', () => ({}));
vi.mock('@/server/oci/runtime', () => ({ isMysqlConfigured: () => false }));
const mocks = vi.hoisted(() => ({ store: {} as ReturnType<typeof getApplicationStore> }));
vi.mock('./store', () => ({ getApplicationStore: () => mocks.store, persistApplicationState: async () => {} }));
vi.mock('./postSessionHandoff', () => ({ deliverPostSessionHandoff: vi.fn() }));
vi.mock('./communicationService', () => ({ dispatchCommunicationMessage: vi.fn() }));
import { runPostSessionAutomation } from './postSessionService';

const now = '2026-10-28T12:00:00Z';
const context: RequestContext = { actor: { actorType: 'staff', organizationId: 'org-test', userId: 'user-test',
  membershipId: 'member-test', membershipStatus: 'active', roles: ['professional', 'billing'], professionalProfileId: 'pro-test' },
  idempotencyKey: 'post-session-test', correlationId: 'test' };
const metadata = { actorUserId: context.actor.userId, occurredAt: now, correlationId: 'test' };
const content = { subjective: 'Relato fictício', objective: 'Observação fictícia', assessment: 'Avaliação fictícia', plan: 'Plano fictício', extractedTasks: [] };
const input = { content, handoff: { summary: '', tasks: [] }, shareWithPatient: false, notifyPatient: false,
  charge: { amountCents: 10000, dueAt: '2026-10-29T12:00:00Z' }, occurredAt: now };
const original = createFinancialCharge({ id: 'charge-booking-test', organizationId: 'org-test', sessionId: 'booking-test',
  patientId: 'patient-test', professionalId: 'pro-test', issuedAt: now, dueAt: input.charge.dueAt, amountCents: 7500, createdAt: now });

beforeEach(() => {
  const record = createClinicalRecordDraft({ id: 'record-test', revisionId: 'revision-test', organizationId: 'org-test',
    patientId: 'patient-test', sessionId: 'session-test', responsibleProfessionalId: 'pro-test', assignedProfessionalIds: ['pro-test'],
    source: 'manual', content, retentionUntil: '2031-10-28T12:00:00Z', createdAt: now }, metadata).record;
  const scheduled = scheduleClinicalSession({ id: 'session-test', organizationId: 'org-test', patientId: 'patient-test',
    primaryProfessionalId: 'pro-test', assignedProfessionalIds: ['pro-test'], mode: 'video', scheduledStart: now,
    scheduledEnd: '2026-10-28T13:00:00Z', automationPlan: { transcription: false, patientHandoff: false, billing: true, receipt: true, notification: false }, createdAt: now }, metadata).session;
  mocks.store = { records: new InMemoryClinicalRecordRepository([record]),
    sessions: new InMemoryClinicalSessionRepository([{ ...scheduled, status: 'awaiting_review',
      automation: { ...scheduled.automation, clinicalDraft: { ...scheduled.automation.clinicalDraft, status: 'requires_review' } } }]),
    timeline: new InMemoryClinicalTimelineRepository(), financial: new InMemoryFinancialRepository(),
    appointments: { list: async () => [{ id: 'booking-test', clinicalSessionId: 'session-test' }] }, identities: {},
    preferences: [], consents: [],
  } as unknown as ReturnType<typeof getApplicationStore>;
});

describe('financeiro do pós-sessão com comandos reais', () => {
  it('reutiliza a cobrança do agendamento, preservando valor e pagamento', async () => {
    const paid = { ...original, status: 'paid' as const, providerReference: 'remote-test', paymentMethod: 'card' as const };
    await mocks.store.financial.saveCharge(paid);
    const result = await runPostSessionAutomation(context, 'session-test', input);
    expect(result.completed).toBe(true);
    expect(result.chargeId).toBe(original.id);
    const ledger = await mocks.store.financial.getLedger({ organizationId: 'org-test' });
    expect(ledger.charges).toEqual([paid]);
  });

  it.each(['paid', 'cancelled', 'refunded'] as const)('repetir a mesma solicitação preserva a cobrança %s depois da conclusão', async (status) => {
    const first = await runPostSessionAutomation(context, 'session-test', input);
    const charge = (await mocks.store.financial.getChargeById(first.chargeId!))!;
    const paid = { ...charge, status, providerReference: 'remote-test', paymentMethod: 'card' as const };
    await mocks.store.financial.saveCharge(paid);
    expect((await runPostSessionAutomation(context, 'session-test', input)).completed).toBe(true);
    expect(await mocks.store.financial.getChargeById(charge.id)).toEqual(paid);
  });
});
