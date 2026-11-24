import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createStaffAccessContext, InMemoryFinancialRepository, type FinancialCharge } from '@thats-life/core';
import type { RequestContext } from './context';

vi.mock('server-only', () => ({}));
const mocks = vi.hoisted(() => ({ store: vi.fn(), query: vi.fn() }));
vi.mock('./store', () => ({ getApplicationStore: mocks.store }));
vi.mock('@/server/oci/runtime', () => ({ isMysqlConfigured: () => true, getMysqlPool: () => ({ query: mocks.query }) }));
vi.mock('@/server/fiscal/nfseRepository', () => ({ NfseRepository: class { async porCobrancas() { return new Map(); } } }));
vi.mock('./persistence', () => ({ readSnapshot: () => null }));
import { getFinancialReportsData, exportFinancialCsvData, getMyFinancialData } from './financialService';
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
const profissional: RequestContext = { actor: createStaffAccessContext({
  id: 'vinculo-profissional', userId: 'usuario-profissional', organizationId: 'org-test', roles: ['professional'],
  status: 'active', professionalProfileId: 'pro-test', createdAt, updatedAt: createdAt,
}), correlationId: 'teste-profissional' };
const october = { startDate: '2026-10-01T00:00:00-03:00', endDate: '2026-10-31T23:59:59.999-03:00' };
let repository: InMemoryFinancialRepository;

beforeEach(() => {
  vi.clearAllMocks(); vi.useFakeTimers(); vi.setSystemTime(new Date('2026-11-10T12:00:00Z'));
  repository = new InMemoryFinancialRepository({ charges: [charge], payments: [{
    id: 'payment-test', chargeId: charge.id, amountCents: 10000, status: 'confirmed', method: 'pix',
    receivedAt: '2026-10-10T12:00:00Z',
  }] });
  mocks.store.mockReturnValue({ financial: repository, appointments: { list: async () => [] }, identities: {
    getPatient: async (_org: string, id: string) => id === 'patient-test' ? { id: 'patient-test', displayName: 'Paciente teste' } : null,
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
  it('reconcilia as parcelas em centavos por cobrança, profissional, mês e exportação', async () => {
    await repository.saveCharge({ ...charge, amountCents: 2002 });
    const payment = { chargeId: charge.id, amountCents: 1001, status: 'confirmed' as const,
      method: 'pix' as const, receivedAt: '2026-10-10T12:00:00Z' };
    await repository.savePayment({ ...payment, id: 'payment-test' });
    await repository.savePayment({ ...payment, id: 'parcela-2' });
    await repository.saveCharge({ ...charge, id: 'outra-cobranca', sessionId: 'outra-sessao', amountCents: 45 });
    await repository.savePayment({ ...payment, id: 'parcela-3', chargeId: 'outra-cobranca', amountCents: 45 });
    const report = await getClinicFinanceOverview(context, october);
    expect(report.atendimentos.find((item) => item.chargeId === charge.id)).toMatchObject({
      recebidoCents: 2002, creditoPsicologoCents: 1402, receitaClinicaCents: 600,
    });
    expect(report.porPsicologo[0].creditoPsicologoCents).toBe(1434);
    expect(report.resumo).toMatchObject({ recebidoCents: 2047, creditoPsicologosCents: 1434, receitaClinicaCents: 613 });
    const extrato = await getMyFinancialData(profissional, october);
    expect(extrato.transactions.map((item) => item.professionalCreditCents).sort((a, b) => a - b)).toEqual([32, 701, 701]);
    expect(extrato.professionalCreditCents).toBe(1434);
    expect(await exportClinicFinanceCsv(context, october)).toContain('14,34');
  });
  it('registra estorno em novembro de pagamento recebido em outubro', async () => {
    await repository.saveRefund({ id: 'refund-test', paymentId: 'payment-test', amountCents: 10000,
      refundedAt: '2026-11-05T12:00:00Z', reason: 'Teste' });
    const november = { startDate: '2026-11-01T00:00:00-03:00', endDate: '2026-11-30T23:59:59-03:00' };
    expect((await getFinancialReportsData(context, november)).summary).toMatchObject({ refundsCents: 10000, netCashCents: -10000 });
    expect((await getClinicFinanceOverview(context, october)).resumo.recebidoCents).toBe(10000);
    expect((await getClinicFinanceOverview(context, november)).resumo).toMatchObject({
      recebidoCents: -10000, creditoPsicologosCents: 0, receitaClinicaCents: -3000,
    });
    expect((await getMyFinancialData(profissional, november)).professionalCreditCents).toBe(0);
  });
  it('concilia estornos parciais em meses diferentes sem descontar automaticamente crédito educacional', async () => {
    await repository.savePayment({ id: 'payment-test', chargeId: charge.id, amountCents: 45,
      status: 'confirmed', method: 'pix', receivedAt: '2026-10-10T12:00:00Z' });
    await repository.saveRefund({ id: 'estorno-a', paymentId: 'payment-test', amountCents: 20,
      refundedAt: '2026-10-12T12:00:00Z', reason: 'Teste' });
    await repository.saveRefund({ id: 'estorno-b', paymentId: 'payment-test', amountCents: 25,
      refundedAt: '2026-11-03T12:00:00Z', reason: 'Teste' });
    expect((await getClinicFinanceOverview(context, october)).resumo).toMatchObject({
      recebidoCents: 25, creditoPsicologosCents: 32, receitaClinicaCents: 7,
    });
    const november = { startDate: '2026-11-01T00:00:00-03:00', endDate: '2026-11-30T23:59:59-03:00' };
    expect((await getClinicFinanceOverview(context, november)).resumo).toMatchObject({
      recebidoCents: -25, creditoPsicologosCents: 0, receitaClinicaCents: -7,
    });
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

describe('crédito da sessão custeada por empresa (especificação final, §§ 10.07 e 11.04)', () => {
  // Sessão de outubro confirmada em novembro; a empresa quita o boleto em dezembro.
  const novembro = { startDate: '2026-11-01T00:00:00-03:00', endDate: '2026-11-30T23:59:59.999-03:00' };
  const dezembro = { startDate: '2026-12-01T00:00:00-03:00', endDate: '2026-12-31T23:59:59.999-03:00' };
  const sessaoEmpresa: FinancialCharge = {
    ...charge, id: 'sessao-empresa', sessionId: 'sessao-empresa', payer: 'company', amountCents: 12000,
    issuedAt: '2026-11-10T12:00:00Z', dueAt: '2026-11-10T12:00:00Z', status: 'paid',
  };

  beforeEach(() => {
    vi.setSystemTime(new Date('2027-01-10T12:00:00Z'));
    repository = new InMemoryFinancialRepository({ charges: [sessaoEmpresa], payments: [{
      id: 'boleto-empresa', chargeId: sessaoEmpresa.id, amountCents: 12000, status: 'confirmed', method: 'boleto',
      receivedAt: '2026-12-15T12:00:00Z',
    }] });
    mocks.store.mockReturnValue({ ...mocks.store(), financial: repository });
  });

  it('lança 70% do valor da sessão no mês da confirmação, sem esperar o boleto', async () => {
    const extrato = await getMyFinancialData(profissional, novembro);
    expect(extrato.professionalCreditCents).toBe(8400);
    expect(extrato.transactions).toEqual([expect.objectContaining({
      receivedAt: '2026-11-10T12:00:00Z', amountCents: 12000, professionalCreditCents: 8400, method: 'convenio',
    })]);
    expect((await getClinicFinanceOverview(context, novembro)).resumo).toMatchObject({
      recebidoCents: 0, creditoPsicologosCents: 8400,
    });
  });

  it('a quitação da empresa entra no caixa sem gerar outro crédito', async () => {
    const extrato = await getMyFinancialData(profissional, dezembro);
    expect(extrato.professionalCreditCents).toBe(0);
    expect(extrato.transactions).toEqual([]);
    expect((await getClinicFinanceOverview(context, dezembro)).resumo).toMatchObject({
      recebidoCents: 12000, creditoPsicologosCents: 0, receitaClinicaCents: 3600,
    });
  });

  it('o repositório MySQL reconhece a cobrança da empresa pelo convênio ou pela fatura', async () => {
    mocks.query.mockImplementation(async (sql: string) => sql.includes('FROM financeiro_cobrancas') ? [[
      { ...{ ref_core: 'da-empresa', organizacao_ref: 'org-test', sessao_ref: 's1', paciente_ref: 'patient-test', profissional_ref: 'pro-test',
        emitida_em: '2026-11-10 12:00:00.000', vence_em: '2026-11-10 12:00:00.000', valor_centavos: 12000, status: 'pending',
        criado_em: '2026-11-10 12:00:00.000', atualizado_em: '2026-11-10 12:00:00.000' }, convenio_ref: 'convenio-ficticio', fatura_convenio_ref: null },
      { ref_core: 'faturada', organizacao_ref: 'org-test', sessao_ref: 's2', paciente_ref: 'patient-test', profissional_ref: 'pro-test',
        emitida_em: '2026-11-10 12:00:00.000', vence_em: '2026-11-10 12:00:00.000', valor_centavos: 12000, status: 'pending',
        criado_em: '2026-11-10 12:00:00.000', atualizado_em: '2026-11-10 12:00:00.000', convenio_ref: null, fatura_convenio_ref: 'fatura-ficticia' },
      { ref_core: 'do-paciente', organizacao_ref: 'org-test', sessao_ref: 's3', paciente_ref: 'patient-test', profissional_ref: 'pro-test',
        emitida_em: '2026-11-10 12:00:00.000', vence_em: '2026-11-10 12:00:00.000', valor_centavos: 12000, status: 'pending',
        criado_em: '2026-11-10 12:00:00.000', atualizado_em: '2026-11-10 12:00:00.000', convenio_ref: null, fatura_convenio_ref: null },
    ]] : [[]]);

    const ledger = await new MysqlFinancialRepository().getLedger({ organizationId: 'org-test' });

    expect(Object.fromEntries(ledger.charges.map((item) => [item.id, item.payer]))).toEqual({
      'da-empresa': 'company', faturada: 'company', 'do-paciente': 'patient',
    });
  });

  it('identifica a sessão ou o pacote em cada linha do extrato do psicólogo (§§ 11.05–11.06)', async () => {
    const sessao1: FinancialCharge = {
      ...charge, id: 'cobranca-1', sessionId: 'sessao-1', issuedAt: '2026-10-05T12:00:00Z',
    };
    const sessao2: FinancialCharge = {
      ...charge, id: 'cobranca-2', sessionId: 'sessao-2', issuedAt: '2026-10-05T16:00:00Z',
    };
    const pacote: FinancialCharge = {
      ...charge, id: 'cobranca-pacote', sessionId: 'pacote-1', amountCents: 40000,
      description: 'Pacote com 4 sessões (outubro)', issuedAt: '2026-10-05T18:00:00Z',
    };
    repository = new InMemoryFinancialRepository({
      charges: [sessao1, sessao2, pacote],
      payments: [
        { id: 'pag-1', chargeId: 'cobranca-1', amountCents: 10000, status: 'confirmed', method: 'pix', receivedAt: '2026-10-05T12:10:00Z' },
        { id: 'pag-2', chargeId: 'cobranca-2', amountCents: 10000, status: 'confirmed', method: 'pix', receivedAt: '2026-10-05T16:10:00Z' },
        { id: 'pag-3', chargeId: 'cobranca-pacote', amountCents: 40000, status: 'confirmed', method: 'card', receivedAt: '2026-10-05T18:10:00Z' },
      ],
    });
    mocks.store.mockReturnValue({
      ...mocks.store(),
      financial: repository,
      appointments: {
        list: async () => [
          {
            id: 'apt-1', clinicalSessionId: 'sessao-1', organizationId: 'org-test',
            patientId: 'patient-test', professionalId: 'pro-test',
            startsAt: '2026-10-06T13:00:00Z', endsAt: '2026-10-06T13:50:00Z',
            serviceKey: 'PSICOTERAPIA', mode: 'video', status: 'scheduled', version: 1,
          },
          {
            id: 'apt-2', clinicalSessionId: 'sessao-2', organizationId: 'org-test',
            patientId: 'patient-test', professionalId: 'pro-test',
            startsAt: '2026-10-07T18:00:00Z', endsAt: '2026-10-07T19:30:00Z',
            serviceKey: 'AVALIACAO', mode: 'in_person', status: 'completed', version: 1,
          },
        ],
      },
    });

    const extrato = await getMyFinancialData(profissional, october);
    expect(extrato.transactions).toHaveLength(3);
    expect(extrato.transactions.find((item) => item.id === 'pag-1')).toMatchObject({
      chargeId: 'cobranca-1',
      sessionId: 'sessao-1',
      sessionStartsAt: '2026-10-06T13:00:00Z',
      originLabel: 'Atendimento Psicológico (Psicoterapia Individual) · 06/10/2026 às 10:00',
    });
    expect(extrato.transactions.find((item) => item.id === 'pag-2')).toMatchObject({
      chargeId: 'cobranca-2',
      sessionId: 'sessao-2',
      sessionStartsAt: '2026-10-07T18:00:00Z',
      originLabel: 'Avaliação Psicológica e Neuropsicológica · 07/10/2026 às 15:00',
    });
    expect(extrato.transactions.find((item) => item.id === 'pag-3')).toMatchObject({
      chargeId: 'cobranca-pacote',
      sessionId: 'pacote-1',
      originLabel: 'Pacote com 4 sessões (outubro)',
    });
  });
});
