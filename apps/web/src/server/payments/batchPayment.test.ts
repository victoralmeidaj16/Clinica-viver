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
import { reserveAppointmentChargeBatch, reconcileInterPix, reconcileAsaasPayment } from './paymentLinkRepository';

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
