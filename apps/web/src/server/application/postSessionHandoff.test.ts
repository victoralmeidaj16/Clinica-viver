import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { PatientHandoff } from '@thats-life/core';
import type { RequestContext } from './context';
import type { PostSessionInput } from './postSessionService';

const mocks = vi.hoisted(() => ({
  store: {} as Record<string, unknown>,
  dispatch: vi.fn(), save: vi.fn(), get: vi.fn(), enqueue: vi.fn(),
  link: vi.fn(), sent: vi.fn(), complete: vi.fn(), fail: vi.fn(), persist: vi.fn(),
}));
vi.mock('server-only', () => ({}));
vi.mock('./store', () => ({ getApplicationStore: () => mocks.store, persistApplicationState: mocks.persist }));
vi.mock('./communicationService', () => ({ dispatchCommunicationMessage: mocks.dispatch }));
vi.mock('@/server/payments/postSessionCharge', () => ({ garantirCobrancaPosSessao: async (charge: unknown) => charge }));
vi.mock('@/server/communication/handoffRepository', () => ({ getHandoff: mocks.get, saveHandoff: mocks.save }));
vi.mock('@thats-life/core', async (importOriginal) => ({
  ...await importOriginal<typeof import('@thats-life/core')>(),
  approveClinicalRecordRevisionCommand: vi.fn(async () => ({ record: { id: 'record', patientId: 'patient', responsibleProfessionalId: 'professional' } })),
  approveClinicalRecordCommand: vi.fn(), projectApprovedClinicalRecord: vi.fn(() => []),
  linkDeliveredPatientHandoffCommand: mocks.link, linkSessionChargeCommand: vi.fn(),
  markSessionReceiptIssuedCommand: vi.fn(), markSessionNotificationSentCommand: mocks.sent,
  completeClinicalSessionCommand: mocks.complete, markSessionAutomationFailedCommand: mocks.fail,
  enqueueNotification: mocks.enqueue,
}));
import { runPostSessionAutomation } from './postSessionService';

const context = { actor: { userId: 'user', organizationId: 'org', professionalProfileId: 'professional' },
  idempotencyKey: 'request-1', correlationId: 'correlation' } as RequestContext;
const input: PostSessionInput = {
  content: { subjective: 'Relato', objective: 'Observação', assessment: 'Avaliação', plan: 'Plano', extractedTasks: [] },
  handoff: { summary: 'Conversamos sobre sua rotina e combinamos pequenas mudanças para a próxima semana.', tasks: ['Anotar atividades'] },
  shareWithPatient: true, notifyPatient: false,
  charge: { amountCents: 7_500, dueAt: '2026-10-24T12:00:00Z' }, occurredAt: '2026-10-22T12:00:00Z',
};

beforeEach(() => {
  vi.clearAllMocks();
  mocks.store = {
    records: { findBySessionId: vi.fn(async () => ({ id: 'record' })) },
    sessions: { getById: vi.fn(async () => ({ patientId: 'patient', primaryProfessionalId: 'professional',
      automationPlan: { patientHandoff: true }, consentRecords: [
        { type: 'patient_handoff', status: 'granted', capturedAt: input.occurredAt },
      ] })) },
    identities: { getProfessional: vi.fn(async () => ({ displayName: 'Profissional' })) },
    timeline: { upsert: vi.fn() }, financial: { saveCharge: vi.fn() },
    notifications: {}, communicationAudit: {},
    preferences: [{ organizationId: 'org', patientId: 'patient', enabledChannels: ['whatsapp'], disabledCategories: [] }],
    consents: [{ organizationId: 'org', patientId: 'patient', channel: 'whatsapp', status: 'granted' }],
  };
  mocks.get.mockResolvedValue(null);
  mocks.save.mockImplementation(async (_org: string, handoff: PatientHandoff) => handoff);
  mocks.enqueue.mockImplementation(async (request) => ({ message: { id: request.id, status: 'queued' } }));
  mocks.dispatch.mockResolvedValue({ message: { status: 'delivered' } });
  mocks.complete.mockResolvedValue({ session: { status: 'completed' } });
  mocks.fail.mockResolvedValue({ session: { status: 'ready_to_complete' } });
});

describe('entrega persistida após sessão', () => {
  it('persiste aprovação e fila antes de enviar, depois persiste entrega e vincula', async () => {
    const result = await runPostSessionAutomation(context, 'session', input);
    expect(mocks.save).toHaveBeenCalledTimes(2);
    expect(mocks.save.mock.calls[0][1].status).toBe('approved');
    expect(mocks.save.mock.calls[1][1].status).toBe('delivered');
    expect(mocks.save.mock.invocationCallOrder[0]).toBeLessThan(mocks.enqueue.mock.invocationCallOrder[0]);
    expect(mocks.enqueue.mock.invocationCallOrder[0]).toBeLessThan(mocks.dispatch.mock.invocationCallOrder[0]);
    expect(mocks.dispatch.mock.invocationCallOrder[0]).toBeLessThan(mocks.save.mock.invocationCallOrder[1]);
    expect(mocks.save.mock.invocationCallOrder[1]).toBeLessThan(mocks.link.mock.invocationCallOrder[0]);
    expect(result.completed).toBe(true);
  });

  it('falha de envio mantém aprovação recuperável e impede conclusão', async () => {
    mocks.dispatch.mockResolvedValue({ message: { status: 'failed' } });
    const result = await runPostSessionAutomation(context, 'session', input);
    expect(result.completed).toBe(false);
    expect(result.failedStep?.step).toBe('patient_handoff');
    expect(mocks.link).not.toHaveBeenCalled();
    expect(mocks.complete).not.toHaveBeenCalled();
    expect(mocks.save.mock.calls.every(([, handoff]) => handoff.status === 'approved')).toBe(true);
  });

  it('cobrança enfileirada não é marcada enviada quando despacho falha', async () => {
    mocks.dispatch.mockResolvedValue({ message: { status: 'failed' } });
    const result = await runPostSessionAutomation(context, 'session', { ...input, shareWithPatient: false, notifyPatient: true });
    expect(result.failedStep?.step).toBe('notification');
    expect(result.completed).toBe(false);
    expect(mocks.sent).not.toHaveBeenCalled();
    expect(mocks.complete).not.toHaveBeenCalled();
  });

  it('reutiliza entrega persistida após reinício sem reenviar', async () => {
    await runPostSessionAutomation(context, 'session', input);
    const saved = mocks.save.mock.calls[1][1];
    vi.clearAllMocks();
    mocks.get.mockResolvedValue(saved);
    const result = await runPostSessionAutomation({ ...context, idempotencyKey: 'retry' }, 'session', input);
    expect(result.completed).toBe(true);
    expect(mocks.dispatch).not.toHaveBeenCalled();
    expect(mocks.link.mock.calls[0][3]).toEqual(saved);
  });

  it('repete aprovação pendente usando a mesma chave de mensagem e o mesmo conteúdo', async () => {
    mocks.dispatch.mockResolvedValueOnce({ message: { status: 'failed' } });
    await runPostSessionAutomation(context, 'session', input);
    const saved = mocks.save.mock.calls[0][1];
    const queued = mocks.enqueue.mock.calls[0][0];
    vi.clearAllMocks();
    mocks.get.mockResolvedValue(saved);
    await runPostSessionAutomation({ ...context, idempotencyKey: 'retry' }, 'session', input);
    expect(mocks.enqueue.mock.calls[0][0].idempotencyKey).toBe(queued.idempotencyKey);
    expect(mocks.enqueue.mock.calls[0][0].template).toEqual(queued.template);
  });

  it('recusa alteração do conteúdo aprovado sem enviar novamente', async () => {
    await runPostSessionAutomation(context, 'session', input);
    const saved = mocks.save.mock.calls[1][1];
    vi.clearAllMocks();
    mocks.get.mockResolvedValue(saved);
    const result = await runPostSessionAutomation(context, 'session', {
      ...input, handoff: { ...input.handoff, tasks: ['Outra atividade'] },
    });
    expect(result.failedStep?.step).toBe('patient_handoff');
    expect(mocks.dispatch).not.toHaveBeenCalled();
  });

  it('não inventa preferências quando cadastro não autoriza comunicação', async () => {
    mocks.store.preferences = [];
    const result = await runPostSessionAutomation(context, 'session', input);
    expect(result.failedStep?.step).toBe('patient_handoff');
    expect(mocks.enqueue).not.toHaveBeenCalled();
    expect(mocks.dispatch).not.toHaveBeenCalled();
  });

  it('valida consentimento clínico antes de enviar', async () => {
    mocks.store.sessions = { getById: vi.fn(async () => ({
      patientId: 'patient', primaryProfessionalId: 'professional',
      automationPlan: { patientHandoff: true }, consentRecords: [],
    })) };
    const result = await runPostSessionAutomation(context, 'session', input);
    expect(result.failedStep?.step).toBe('patient_handoff');
    expect(mocks.dispatch).not.toHaveBeenCalled();
  });
});
