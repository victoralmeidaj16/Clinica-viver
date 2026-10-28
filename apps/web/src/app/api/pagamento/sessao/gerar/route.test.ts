import { DatabaseSync } from 'node:sqlite';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
vi.mock('server-only', () => ({}));
const mocks = vi.hoisted(() => ({
  reserve: vi.fn(), bind: vi.fn(), find: vi.fn(), create: vi.fn(), get: vi.fn(), execute: vi.fn(),
}));
vi.mock('@/server/http/publicRequest', () => ({ rateLimited: () => false, validCpf: () => true }));
vi.mock('@/server/oci/runtime', () => ({ getMysqlPool: () => ({ execute: mocks.execute }) }));
vi.mock('@/server/persistence/mysql/mappers', () => ({ instituicaoId: () => 'inst-test' }));
vi.mock('@/server/payments/paymentLinkRepository', () => ({
  SessionChargeUnavailableError: class extends Error {}, reserveAppointmentCharge: mocks.reserve,
  bindProviderPayment: mocks.bind, claimCheckoutProvider: async () => 'asaas',
  isCompanyFundedReservation: () => false, isExpiredReservation: () => false,
}));
vi.mock('@/server/adapters/interPixAdapter', () => ({}));
vi.mock('@/server/adapters/asaasAdapter', () => ({
  createAsaasPayment: mocks.create, findAsaasPaymentByExternalReference: mocks.find, getAsaasPayment: mocks.get,
  getOrCreateAsaasCustomer: async () => 'customer-test',
}));
import { POST } from './route';

const checkout = { externalReference: 'VM-test', chargeId: 'charge-test', amountCents: 10000,
  patientName: 'Paciente fictício', patientCpf: '52998224725', professionalName: 'Profissional fictício', dueAt: '2099-01-01T12:00:00Z' };
const request = () => new Request('http://localhost/api/pagamento/sessao/gerar', { method: 'POST',
  body: JSON.stringify({ token: 'a'.repeat(32), cpf: checkout.patientCpf, paymentMethod: 'CREDIT_CARD' }) });
let database: DatabaseSync;
beforeEach(() => {
  vi.resetAllMocks();
  database = new DatabaseSync(':memory:');
  database.exec(`CREATE TABLE financeiro_checkouts_asaas (
    instituicao_id TEXT, referencia_externa TEXT, provedor TEXT, provedor_pagamento_ref TEXT,
    erro_codigo TEXT, status TEXT);
    INSERT INTO financeiro_checkouts_asaas VALUES ('inst-test', 'VM-test', 'asaas', NULL, NULL, 'creating');`);
  mocks.reserve.mockResolvedValue(checkout);
  mocks.find.mockResolvedValue(null);
  mocks.create.mockResolvedValue({ id: 'remote-test', value: 100, status: 'PENDING', invoiceUrl: 'https://example.test/invoice' });
  mocks.execute.mockImplementation(async (sql: string, params: Array<string | null>) => {
    const result = database.prepare(sql).run(...params);
    return [{ affectedRows: Number(result.changes) }];
  });
});
afterEach(() => database.close());

describe('emissão concorrente do cartão', () => {
  it('duas solicitações simultâneas emitem somente uma cobrança', async () => {
    const responses = await Promise.all([POST(request()), POST(request())]);
    expect(mocks.create).toHaveBeenCalledTimes(1);
    expect(responses.map((r) => r.status).sort()).toEqual([200, 409]);
    expect(mocks.create).toHaveBeenCalledWith(expect.objectContaining({ externalReference: 'VM-test', value: 100, billingType: 'CREDIT_CARD' }));
  });

  it('após timeout consulta o pagamento existente e não emite novamente', async () => {
    mocks.create.mockRejectedValueOnce(new Error('timeout simulado'));
    expect((await POST(request())).status).toBe(500);
    expect(database.prepare('SELECT erro_codigo FROM financeiro_checkouts_asaas').get()?.erro_codigo).toBe('CARD_UNKNOWN');
    mocks.find.mockResolvedValue({ id: 'remote-test', value: 100, status: 'PENDING' });
    expect((await POST(request())).status).toBe(200);
    expect(mocks.create).toHaveBeenCalledTimes(1);
    expect(mocks.bind).toHaveBeenCalledWith(checkout, 'remote-test', 'card', 'asaas');
  });

  it('resultado incerto ainda não encontrado bloqueia nova emissão', async () => {
    mocks.create.mockRejectedValueOnce(new Error('timeout simulado'));
    await POST(request());
    expect((await POST(request())).status).toBe(409);
    expect(mocks.create).toHaveBeenCalledTimes(1);
  });
  it('falha ao vincular no banco recupera a mesma cobrança por referência externa', async () => {
    mocks.bind.mockRejectedValueOnce(new Error('falha simulada ao vincular'));
    expect((await POST(request())).status).toBe(500);
    mocks.find.mockResolvedValue({ id: 'remote-test', value: 100, status: 'PENDING' });
    expect((await POST(request())).status).toBe(200);
    expect(mocks.create).toHaveBeenCalledTimes(1);
    expect(mocks.bind).toHaveBeenCalledTimes(2);
  });
});
