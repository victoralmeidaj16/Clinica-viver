import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
vi.mock('server-only', () => ({}));
const { connection } = vi.hoisted(() => ({ connection: {
  beginTransaction: vi.fn(), commit: vi.fn(), rollback: vi.fn(), release: vi.fn(),
  query: vi.fn(), execute: vi.fn<(sql: string, values: unknown[]) => Promise<unknown>>(async () => [{ affectedRows: 1 }, []]),
} }));
vi.mock('@/server/oci/runtime', () => ({ getMysqlPool: () => ({ getConnection: async () => connection }) }));
vi.mock('@/server/persistence/mysql/mappers', () => ({
  instituicaoId: () => 'inst', rowId: (prefix: string, ref: string) => `${prefix}:${ref}`,
  fromSqlTimestamp: (value: string) => new Date(value).toISOString(),
  toSqlTimestamp: (value: string) => value,
}));
import { claimCheckoutProvider, reserveAppointmentCharge, reserveAppointmentChargeBatch, reconcileInterPix, reconcileAsaasPayment } from './paymentLinkRepository';

beforeEach(() => { vi.clearAllMocks(); vi.useFakeTimers(); vi.setSystemTime(new Date('2026-09-01T12:00:00Z')); });
afterEach(() => vi.useRealTimers());

function mockReservations(futureMonth = false) {
  connection.query.mockImplementation(async (sql: string, values: unknown[]) => {
    if (sql.includes('FROM clinica_agendamentos a')) {
      const token = String(values[1]);
      return [[{ agendamento_ref: token, inicio: futureMonth && token === 'd' ? '2026-10-10T12:00:00Z' : '2026-09-10T12:00:00Z',
        valor_centavos: 10000, organizacao_ref: 'org', paciente_ref: 'patient', paciente_nome: 'Paciente',
        paciente_cpf: '123', profissional_nome: 'Profissional', profissional_ref: 'pro' }], []];
    }
    return [[], []];
  });
}

describe('reserva mensal no servidor', () => {
  it('rejeita mistura de meses antes de gravar o agrupamento', async () => {
    mockReservations(true);
    await expect(reserveAppointmentChargeBatch({ tokens: ['a', 'b', 'c', 'd'], cpf: '123' })).rejects.toThrow('mês vigente');
    expect(connection.execute.mock.calls.some(([sql]) => String(sql).includes('INSERT INTO financeiro_checkout_cobrancas'))).toBe(false);
  });
  it('reserva valor líquido por sessão e total com desconto', async () => {
    mockReservations();
    const checkout = await reserveAppointmentChargeBatch({ tokens: ['a', 'b', 'c', 'd'], cpf: '123' });
    expect(checkout).toMatchObject({ amountCents: 36000, subtotalCents: 40000, discountCents: 4000 });
    const mappings = connection.execute.mock.calls.filter(([sql]) => String(sql).includes('INSERT INTO financeiro_checkout_cobrancas'));
    expect(mappings).toHaveLength(4);
    expect(mappings.every((call) => (call[1] as unknown[])[3] === 9000)).toBe(true);
  });
  it('tokens duplicados não aumentam o número de sessões para desconto', async () => {
    mockReservations();
    expect(await reserveAppointmentChargeBatch({ tokens: ['a', 'b', 'c', 'c'], cpf: '123' })).toMatchObject({ amountCents: 30000, discountCents: 0 });
  });
});

describe.each(['inter', 'asaas'])('conciliação com desconto: %s', (provider) => {
  it('registra o desconto e quita as quatro cobranças pelo valor líquido', async () => {
    connection.query.mockImplementation(async (sql: string) => sql.includes('SELECT DISTINCT c.organizacao_ref')
      ? [Array.from({ length: 4 }, (_, i) => ({ organizacao_ref: 'org', ref_core: `charge-${i}`, valor_centavos: 9000, desconto_centavos: 1000 })), []]
      : [[], []]);
    const common = { eventId: 'event', amountCents: 36000, receivedAt: '2026-09-01T12:00:00Z' };
    const result = provider === 'inter'
      ? await reconcileInterPix({ ...common, txid: 'tx', endToEndId: 'end' })
      : await reconcileAsaasPayment({ ...common, paymentId: 'pay', eventType: 'PAYMENT_RECEIVED', billingType: 'CREDIT_CARD' });
    expect(result).toBe('processed');
    const discounts = connection.execute.mock.calls.filter(([sql]) => String(sql).includes('INSERT INTO financeiro_descontos'));
    expect(discounts).toHaveLength(4);
    const statuses = connection.execute.mock.calls.filter(([sql]) => String(sql).includes('UPDATE financeiro_cobrancas SET status'));
    expect(statuses).toHaveLength(4);
    expect(statuses.every((call) => (call[1] as unknown[])[0] === 'paid')).toBe(true);
  });
});


describe('proteção contra cobrar novamente uma sessão quitada', () => {
  it.each(['paid', 'refunded', 'partially_paid'])('recusa cobrança com status %s antes de criar checkout', async (status) => {
    connection.query.mockImplementation(async (sql: string) => {
      if (sql.includes('FROM clinica_agendamentos a')) return [[{
        agendamento_ref: 'a', inicio: '2026-09-10T12:00:00Z', valor_centavos: 10000,
        organizacao_ref: 'org', paciente_ref: 'p', profissional_ref: 'pro',
      }], []];
      if (sql.includes('FROM financeiro_cobrancas c')) return [[{
        cobranca_ref: 'charge', cobranca_status: status, vence_em: '2026-09-10T12:00:00Z',
      }], []];
      return [[], []];
    });
    await expect(reserveAppointmentCharge({ token: 'a', cpf: '123' })).rejects.toThrow(
      status === 'paid' ? 'já está paga' : 'já possui pagamento ou estorno'
    );
    expect(connection.execute).not.toHaveBeenCalled();
    expect(connection.rollback).toHaveBeenCalled();
  });
});


describe('checkout invalidado pelo cancelamento', () => {
  it.each(['expired', 'paid', 'refunded'])('não reserva provedor para checkout %s', async (status) => {
    connection.query.mockResolvedValue([[{ provedor: 'asaas', status }], []]);
    await expect(claimCheckoutProvider('VM-old', 'asaas')).rejects.toThrow('não está mais disponível');
    expect(connection.rollback).toHaveBeenCalled();
  });
  it('continua permitindo checkout ativo', async () => {
    connection.query.mockResolvedValue([[{ provedor: 'inter', status: 'creating' }], []]);
    expect(await claimCheckoutProvider('VM-active', 'inter')).toBe('inter');
  });
});

describe('retomada de pagamento agrupado', () => {
  function existingGroup(provider: 'asaas' | 'inter', grouped = true) {
    connection.query.mockImplementation(async (sql: string, values: unknown[]) => {
      if (sql.includes('FROM clinica_agendamentos a')) return [[{
        agendamento_ref: values[1], inicio: '2026-09-10T12:00:00Z', valor_centavos: 10000,
        organizacao_ref: 'org', paciente_ref: 'patient', profissional_ref: 'pro',
      }], []];
      if (sql.includes('FROM financeiro_cobrancas c')) {
        const token = String(values[2]);
        return [[{ cobranca_ref: token, cobranca_status: 'pending', vence_em: '2026-09-10T12:00:00Z',
          checkout_ref: `checkout-${token}`, referencia_externa: `VM-${token}`,
          checkout_provedor: token === 'a' ? provider : undefined,
          provedor_pagamento_ref: token === 'a' ? 'remote-existing' : undefined }], []];
      }
      if (sql.includes('SELECT referencia_externa')) return [grouped ? [{ referencia_externa: 'VM-a' }, { referencia_externa: 'VM-a' }] : [], []];
      if (sql.includes('SELECT cobranca_ref, valor_centavos')) return [grouped ? [
        { cobranca_ref: 'a', valor_centavos: 10000 }, { cobranca_ref: 'b', valor_centavos: 10000 },
      ] : [], []];
      return [[], []];
    });
  }
  it.each(['asaas', 'inter'] as const)('recupera pagamento %s e aceita ordem invertida', async (provider) => {
    existingGroup(provider);
    expect(await reserveAppointmentChargeBatch({ tokens: ['b', 'a'], cpf: '123' })).toMatchObject({
      externalReference: 'VM-a', providerPaymentId: 'remote-existing', provider, amountCents: 20000,
    });
  });
  it('não transforma pagamento individual já emitido em grupo', async () => {
    existingGroup('asaas', false);
    await expect(reserveAppointmentChargeBatch({ tokens: ['a', 'b'], cpf: '123' })).rejects.toThrow('individual iniciado');
  });
  it('recusa adicionar sessão a um grupo já emitido', async () => {
    existingGroup('inter');
    await expect(reserveAppointmentChargeBatch({ tokens: ['a', 'b', 'c'], cpf: '123' })).rejects.toThrow('grupo original');
  });
});
