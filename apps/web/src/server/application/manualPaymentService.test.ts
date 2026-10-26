import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createStaffAccessContext, InMemoryFinancialRepository, generateFinancialReports, type FinancialCharge } from '@thats-life/core';
vi.mock('server-only', () => ({}));
const mocks = vi.hoisted(() => ({ mysql: false, connection: {
  beginTransaction: vi.fn(), query: vi.fn(), execute: vi.fn(), commit: vi.fn(), rollback: vi.fn(), release: vi.fn(),
}, persist: vi.fn(), getStore: vi.fn() }));
vi.mock('@/server/oci/runtime', () => ({ isMysqlConfigured: () => mocks.mysql,
  getMysqlPool: () => ({ getConnection: async () => mocks.connection }) }));
vi.mock('./store', () => ({ getApplicationStore: mocks.getStore, persistApplicationState: mocks.persist }));
import { registerManualPayment, validateManualPayment } from './manualPaymentService';
import { MysqlFinancialRepository } from '@/server/persistence/mysql/financialRepository';
import type { RequestContext } from './context';

const charge: FinancialCharge = {
  id: 'charge-test', organizationId: 'org-test', sessionId: 'session-test', patientId: 'patient-test',
  professionalId: 'professional-test', amountCents: 7500, status: 'pending',
  issuedAt: '2026-01-01T12:00:00Z', dueAt: '2099-01-01T12:00:00Z',
  createdAt: '2026-01-01T12:00:00Z', updatedAt: '2026-01-01T12:00:00Z',
};
const context: RequestContext = { actor: createStaffAccessContext({
  id: 'membership-test', userId: 'admin-test', organizationId: 'org-test', roles: ['admin'], status: 'active',
  createdAt: charge.createdAt, updatedAt: charge.updatedAt,
}), correlationId: 'test', idempotencyKey: 'test-1' };
const body = { amountCents: 7500, expectedOutstandingCents: 7500, receivedAt: '2026-01-02', method: 'pix' };
let repository: InMemoryFinancialRepository;
beforeEach(() => {
  vi.restoreAllMocks(); vi.clearAllMocks(); mocks.mysql = false;
  mocks.connection.query.mockReset().mockResolvedValue([[]]);
  mocks.connection.execute.mockReset().mockResolvedValue([{ affectedRows: 1 }]);
  repository = new InMemoryFinancialRepository({ charges: [charge] });
  mocks.getStore.mockReturnValue({ financial: repository });
});

describe('recebimento manual', () => {
  it('quita a cobrança e registra autoria, data e valores nos relatórios', async () => {
    await registerManualPayment(context, charge.id, body);
    const ledger = await repository.getLedger({ organizationId: 'org-test' });
    expect(ledger.charges[0].status).toBe('paid');
    expect(ledger.payments[0]).toMatchObject({ amountCents: 7500, provider: 'manual', registeredBy: 'admin-test' });
    expect(ledger.payments[0].registeredAt).toBeTruthy();
    const report = generateFinancialReports(ledger, { organizationId: 'org-test' }, '2026-01-03T12:00:00Z');
    expect(report.summary.outstandingCents).toBe(0);
    expect(report.receivables[0].paidAmountCents).toBe(7500);
  });
  it('recebe parcialmente e permite quitar o restante em novo lançamento', async () => {
    await registerManualPayment(context, charge.id, { ...body, amountCents: 3000 });
    expect((await repository.getChargeById(charge.id))?.status).toBe('partially_paid');
    await registerManualPayment({ ...context, idempotencyKey: 'test-2' }, charge.id,
      { ...body, amountCents: 4500, expectedOutstandingCents: 4500 });
    expect((await repository.getChargeById(charge.id))?.status).toBe('paid');
  });
  it('reenvio idêntico não duplica; mesma chave com outro valor é recusada', async () => {
    await registerManualPayment(context, charge.id, body);
    expect(await registerManualPayment(context, charge.id, body)).toMatchObject({ duplicate: true });
    await expect(registerManualPayment(context, charge.id, { ...body, amountCents: 1000 })).rejects.toMatchObject({ status: 409 });
    expect((await repository.getLedger({ organizationId: 'org-test' })).payments).toHaveLength(1);
  });
  it('serializa solicitações simultâneas com chaves distintas e saldo antigo', async () => {
    const results = await Promise.allSettled([
      registerManualPayment(context, charge.id, { ...body, amountCents: 3000 }),
      registerManualPayment({ ...context, idempotencyKey: 'test-2' }, charge.id, { ...body, amountCents: 3000 }),
    ]);
    expect(results.map((result) => result.status)).toEqual(['fulfilled', 'rejected']);
    expect((await repository.getLedger({ organizationId: 'org-test' })).payments).toHaveLength(1);
  });
  it('recusa acesso de outro perfil e cobranças de outra organização', async () => {
    await expect(registerManualPayment({ ...context, actor: { ...context.actor, roles: ['professional'] } }, charge.id, body))
      .rejects.toMatchObject({ status: 403 });
    await expect(registerManualPayment({ ...context, actor: { ...context.actor, organizationId: 'other-org' } }, charge.id, body))
      .rejects.toMatchObject({ status: 404 });
    expect((await repository.getLedger({ organizationId: 'org-test' })).payments).toHaveLength(0);
  });
  it.each(['cancelled', 'refunded', 'paid', 'draft'] as const)('recusa cobrança %s', async (status) => {
    await repository.saveCharge({ ...charge, status });
    await expect(registerManualPayment(context, charge.id, body)).rejects.toMatchObject({ status: 409 });
  });
  it('respeita descontos e recusa recebimento acima do saldo líquido', async () => {
    await repository.saveDiscount({ id: 'discount-test', chargeId: charge.id, amountCents: 1500,
      reason: 'Teste', appliedAt: charge.createdAt, createdBy: 'admin-test' });
    await expect(registerManualPayment(context, charge.id, { ...body, expectedOutstandingCents: 6000 })).rejects.toMatchObject({ status: 400 });
  });
  it.each([
    { amountCents: 0 }, { amountCents: -1 }, { amountCents: 1.5 }, { method: 'invalid' },
    { receivedAt: '2026-02-30' }, { receivedAt: '2099-01-01' }, { receivedAt: 'invalid' },
  ])('valida entrada %j', (invalid) => {
    expect(() => validateManualPayment({ ...body, ...invalid })).toThrow();
  });
  it('exige chave de idempotência', async () => {
    await expect(registerManualPayment({ ...context, idempotencyKey: undefined }, charge.id, body)).rejects.toMatchObject({ status: 400 });
  });
  it('bloqueia a cobrança antes de ler o saldo no MySQL e reverte falhas', async () => {
    mocks.mysql = true;
    mocks.connection.query.mockResolvedValueOnce([[{ ref_core: charge.id }]])
      .mockResolvedValueOnce([[{ custeado: 1 }]]);
    await expect(registerManualPayment(context, charge.id, body)).rejects.toMatchObject({ status: 409 });
    expect(mocks.connection.query.mock.calls[0][0]).toContain('FOR UPDATE');
    expect(mocks.connection.query.mock.calls[0][1]).toContain('org-test');
    expect(mocks.connection.rollback).toHaveBeenCalledOnce();
    expect(mocks.connection.commit).not.toHaveBeenCalled();
    expect(mocks.connection.release).toHaveBeenCalledOnce();
  });
  it('não acessa cobrança ausente no MySQL', async () => {
    mocks.mysql = true; mocks.connection.query.mockResolvedValueOnce([[]]);
    await expect(registerManualPayment(context, charge.id, body)).rejects.toMatchObject({ status: 404 });
    expect(mocks.connection.rollback).toHaveBeenCalledOnce();
  });
});

describe('transação MySQL do recebimento', () => {
  function prepare() {
    mocks.mysql = true;
    mocks.connection.query.mockResolvedValueOnce([[{ ref_core: charge.id }]])
      .mockResolvedValueOnce([[{ custeado: 0 }]]);
    vi.spyOn(MysqlFinancialRepository.prototype, 'getLedger').mockImplementation((filter) => repository.getLedger(filter));
    const payment = vi.spyOn(MysqlFinancialRepository.prototype, 'savePayment').mockResolvedValue();
    const update = vi.spyOn(MysqlFinancialRepository.prototype, 'saveCharge').mockResolvedValue();
    return { payment, update };
  }
  it('confirma pagamento e status na mesma transação com autoria', async () => {
    const { payment, update } = prepare();
    await registerManualPayment(context, charge.id, body);
    expect(payment).toHaveBeenCalledWith(expect.objectContaining({ registeredBy: 'admin-test', provider: 'manual' }));
    expect(update).toHaveBeenCalledWith(expect.objectContaining({ status: 'paid' }));
    expect(mocks.connection.commit).toHaveBeenCalledOnce();
    expect(mocks.connection.rollback).not.toHaveBeenCalled();
    expect(mocks.connection.release).toHaveBeenCalledOnce();
  });
  it('reverte o lançamento se falhar a atualização da cobrança', async () => {
    const { update } = prepare();
    update.mockRejectedValueOnce(new Error('Falha simulada'));
    await expect(registerManualPayment(context, charge.id, body)).rejects.toThrow('Falha simulada');
    expect(mocks.connection.commit).not.toHaveBeenCalled();
    expect(mocks.connection.rollback).toHaveBeenCalledOnce();
    expect(mocks.connection.release).toHaveBeenCalledOnce();
  });
  it.each(['asaas', 'inter'])('recusa baixa com checkout %s iniciado, sem registrar pagamento', async (provider) => {
    const { payment, update } = prepare();
    mocks.connection.query.mockImplementation(async (sql: string) => [sql.includes('FROM financeiro_checkouts_asaas')
      ? [{ provedor: provider, provedor_pagamento_ref: 'remote-test', status: 'pending' }] : []]);
    await expect(registerManualPayment(context, charge.id, body)).rejects.toMatchObject({ status: 409 });
    expect(payment).not.toHaveBeenCalled();
    expect(update).not.toHaveBeenCalled();
    expect(mocks.connection.execute).not.toHaveBeenCalled();
    expect(mocks.connection.commit).not.toHaveBeenCalled();
    expect(mocks.connection.rollback).toHaveBeenCalledOnce();
  });
  it('recusa membro de grupo mesmo sem provedor na própria cobrança', async () => {
    const { payment, update } = prepare();
    mocks.connection.query.mockImplementation(async (sql: string) => [sql.includes('FROM financeiro_checkout_cobrancas')
      ? [{ referencia_externa: 'VM-group-test' }] : []]);
    await expect(registerManualPayment(context, charge.id, body)).rejects.toMatchObject({ status: 409 });
    expect(payment).not.toHaveBeenCalled();
    expect(update).not.toHaveBeenCalled();
    expect(mocks.connection.commit).not.toHaveBeenCalled();
  });
  it('recusa pagamento em emissão antes de receber a referência externa', async () => {
    const { payment } = prepare();
    mocks.connection.query.mockImplementation(async (sql: string) => [sql.includes('FROM financeiro_checkouts_asaas')
      ? [{ provedor: 'inter', provedor_pagamento_ref: null, status: 'creating' }] : []]);
    await expect(registerManualPayment(context, charge.id, body)).rejects.toMatchObject({ status: 409 });
    expect(payment).not.toHaveBeenCalled();
  });
  it('invalida checkout não iniciado na mesma transação da baixa', async () => {
    prepare();
    await registerManualPayment(context, charge.id, body);
    expect(mocks.connection.execute).toHaveBeenCalledWith(
      expect.stringContaining("status = 'expired'"), expect.arrayContaining(['org-test', charge.id]),
    );
    expect(mocks.connection.commit).toHaveBeenCalledOnce();
  });
  it('recusa referência externa legada mesmo sem checkout', async () => {
    const { payment } = prepare();
    await repository.saveCharge({ ...charge, providerReference: 'legacy-test' });
    await expect(registerManualPayment(context, charge.id, body)).rejects.toMatchObject({ status: 409 });
    expect(payment).not.toHaveBeenCalled();
  });
});
