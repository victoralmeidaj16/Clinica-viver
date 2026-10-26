import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createStaffAccessContext, InMemoryFinancialRepository, type FinancialCharge } from '@thats-life/core';
import type { RequestContext } from './context';

vi.mock('server-only', () => ({}));
const mocks = vi.hoisted(() => ({ store: vi.fn(), query: vi.fn() }));
vi.mock('./store', () => ({ getApplicationStore: mocks.store }));
vi.mock('@/server/oci/runtime', () => ({ isMysqlConfigured: () => true, getMysqlPool: () => ({ query: mocks.query }) }));
vi.mock('@/server/fiscal/nfseRepository', () => ({ NfseRepository: class { async porCobrancas() { return new Map(); } } }));
import { getFinancialReportsData, exportFinancialCsvData } from './financialService';
import { getClinicFinanceOverview, exportClinicFinanceCsv } from './clinicFinanceService';
import { MysqlFinancialRepository } from '@/server/persistence/mysql/financialRepository';

const createdAt = '2026-09-20T12:00:00Z';
const charge: FinancialCharge = {
  id: 'charge-test', organizationId: 'org-test', sessionId: 'session-test', patientId: 'patient-test',
  professionalId: 'pro-test', amountCents: 10000, status: 'paid', issuedAt: createdAt,
  dueAt: '2026-10-10T12:00:00Z', createdAt, updatedAt: createdAt,
};
const context: RequestContext = { actor: createStaffAccessContext({
  id: 'membership-test', userId: 'admin-test', organizationId: 'org-test', roles: ['admin'], status: 'active',
  createdAt, updatedAt: createdAt,
}), correlationId: 'test' };
const october = { startDate: '2026-10-01T00:00:00-03:00', endDate: '2026-10-31T23:59:59.999-03:00' };
let repository: InMemoryFinancialRepository;

beforeEach(() => {
  vi.clearAllMocks(); vi.useFakeTimers(); vi.setSystemTime(new Date('2026-11-10T12:00:00Z'));
  repository = new InMemoryFinancialRepository({ charges: [charge], payments: [{
    id: 'payment-test', chargeId: charge.id, amountCents: 10000, status: 'confirmed', method: 'pix',
    receivedAt: '2026-10-10T12:00:00Z',
  }] });
  mocks.store.mockReturnValue({ financial: repository, identities: {
    listPatients: async () => [{ id: 'patient-test', displayName: 'Paciente teste' }],
    listMemberships: async () => [{ professionalProfileId: 'pro-test' }],
    getProfessional: async () => ({ id: 'pro-test', displayName: 'Profissional teste' }),
  } });
  mocks.query.mockResolvedValue([[]]);
});
afterEach(() => vi.useRealTimers());

describe('recebimentos do período independem da emissão da cobrança', () => {
  it('preserva o pagamento antigo também pelo repositório MySQL usado em produção', async () => {
    mocks.store.mockReturnValue({ ...mocks.store(), financial: new MysqlFinancialRepository() });
    mocks.query.mockImplementation(async (sql: string) => {
      if (sql.includes('ORDER BY emitida_em')) return [sql.includes('emitida_em >=') ? [] : [{
        ref_core: charge.id, organizacao_ref: 'org-test', sessao_ref: 'session-test', paciente_ref: 'patient-test',
        profissional_ref: 'pro-test', emitida_em: '2026-09-20 12:00:00.000', vence_em: '2026-10-10 12:00:00.000', valor_centavos: 10000,
        status: 'paid', forma_pagamento: 'pix', criado_em: '2026-09-20 12:00:00.000', atualizado_em: '2026-09-20 12:00:00.000',
      }]];
      if (sql.includes('FROM financeiro_pagamentos')) return [[{
        ref_core: 'payment-test', cobranca_ref: charge.id, recebido_em: '2026-10-10 12:00:00.000',
        valor_centavos: 10000, forma: 'pix', status: 'confirmed',
      }]];
      return [[]];
    });
    expect((await getFinancialReportsData(context, october)).summary.receivedCents).toBe(10000);
    expect((await getClinicFinanceOverview(context, october)).resumo.recebidoCents).toBe(10000);
  });
  it('inclui no caixa de outubro pagamento de cobrança emitida em setembro', async () => {
    const report = await getFinancialReportsData(context, october);
    expect(report.summary.receivedCents).toBe(10000);
    expect(report.summary.netBilledCents).toBe(0);
    expect(report.cashFlow.entries).toMatchObject([{ id: 'payment-test', amountCents: 10000 }]);
    expect(await exportFinancialCsvData(context, october)).toContain('Recebido;100,00');
  });
  it('inclui o recebimento no painel, no profissional e no CSV sem refaturar a cobrança antiga', async () => {
    const report = await getClinicFinanceOverview(context, october);
    expect(report.resumo).toMatchObject({ recebidoCents: 10000, faturadoCents: 0, creditoPsicologosCents: 7000, receitaClinicaCents: 3000 });
    expect(report.atendimentos).toMatchObject([{ chargeId: charge.id, recebidoCents: 10000 }]);
    expect(report.porPsicologo).toMatchObject([{ recebidoCents: 10000, faturadoCents: 0 }]);
    expect(await exportClinicFinanceCsv(context, october)).toContain('Recebido;100,00');
  });
  it('não atribui a outubro um pagamento recebido em novembro', async () => {
    await repository.saveCharge({ ...charge, issuedAt: '2026-10-02T12:00:00Z' });
    await repository.savePayment({ id: 'payment-test', chargeId: charge.id, amountCents: 10000,
      status: 'confirmed', method: 'pix', receivedAt: '2026-11-01T12:00:00Z' });
    const report = await getClinicFinanceOverview(context, october);
    expect(report.resumo).toMatchObject({ recebidoCents: 0, faturadoCents: 10000 });
    expect(report.atendimentos[0].recebidoCents).toBe(0);
  });
  it('contabiliza só a parcela recebida no mês e preserva o saldo acumulado', async () => {
    await repository.saveCharge({ ...charge, status: 'partially_paid' });
    await repository.savePayment({ id: 'payment-test', chargeId: charge.id, amountCents: 3000,
      status: 'confirmed', method: 'pix', receivedAt: '2026-09-25T12:00:00Z' });
    await repository.savePayment({ id: 'payment-oct', chargeId: charge.id, amountCents: 4000,
      status: 'confirmed', method: 'cash', receivedAt: '2026-10-10T12:00:00Z' });
    const report = await getClinicFinanceOverview(context, october);
    expect(report.resumo.recebidoCents).toBe(4000);
    expect(report.atendimentos[0]).toMatchObject({ recebidoCents: 4000, emAbertoCents: 3000 });
  });
  it('registra estorno em novembro de pagamento recebido em outubro', async () => {
    await repository.saveRefund({ id: 'refund-test', paymentId: 'payment-test', amountCents: 10000,
      refundedAt: '2026-11-05T12:00:00Z', reason: 'Teste' });
    const november = { startDate: '2026-11-01T00:00:00-03:00', endDate: '2026-11-30T23:59:59-03:00' };
    expect((await getFinancialReportsData(context, november)).summary).toMatchObject({ refundsCents: 10000, netCashCents: -10000 });
    expect((await getClinicFinanceOverview(context, october)).resumo.recebidoCents).toBe(10000);
    expect((await getClinicFinanceOverview(context, november)).resumo.recebidoCents).toBe(-10000);
  });
  it('respeita os limites do mês no fuso da clínica e não mistura organizações', async () => {
    await repository.savePayment({ id: 'payment-test', chargeId: charge.id, amountCents: 10000,
      status: 'confirmed', method: 'pix', receivedAt: '2026-11-01T02:59:59.999Z' });
    await repository.saveCharge({ ...charge, id: 'other-charge', organizationId: 'other-org' });
    await repository.savePayment({ id: 'other-payment', chargeId: 'other-charge', amountCents: 99900,
      status: 'confirmed', method: 'pix', receivedAt: '2026-10-10T12:00:00Z' });
    expect((await getFinancialReportsData(context, october)).summary.receivedCents).toBe(10000);
    expect((await getClinicFinanceOverview(context, october)).resumo.recebidoCents).toBe(10000);
  });
});
