import { beforeEach, describe, expect, it, vi } from 'vitest';
vi.mock('server-only', () => ({}));
const db = vi.hoisted(() => ({ query: vi.fn(), execute: vi.fn(), beginTransaction: vi.fn(), commit: vi.fn(), rollback: vi.fn(), release: vi.fn() }));
vi.mock('@/server/oci/runtime', () => ({ getMysqlPool: () => ({ getConnection: async () => db }) }));
vi.mock('@/server/persistence/mysql/mappers', () => ({ instituicaoId: () => 'inst-test', rowId: (_p: string, ref: string) => ref, toSqlTimestamp: (v: string) => v }));
import { reconcileInterPix, reconcileAsaasPayment } from './paymentLinkRepository';

type Payment = { ref_core: string; cobranca_ref: string; valor_centavos: number };
let payments: Map<string, Payment>;
let events: Set<string>;
let charges: Array<{ organizacao_ref: string; ref_core: string; valor_centavos: number; desconto_centavos: number }>;
let statuses: Map<string, string>;
let checkoutStatus: string;
const when = '2026-10-28T12:00:00Z';
const pix = (id: string, amountCents: number, eventId = id) => reconcileInterPix({ eventId, txid: 'tx-test', endToEndId: id, amountCents, receivedAt: when });
const card = (eventId: string, amountCents: number) => reconcileAsaasPayment({ eventId, paymentId: 'pay-test', amountCents,
  receivedAt: when, eventType: 'PAYMENT_RECEIVED', billingType: 'CREDIT_CARD' });

beforeEach(() => {
  vi.clearAllMocks();
  payments = new Map(); events = new Set(); statuses = new Map(); checkoutStatus = 'pending';
  charges = [{ organizacao_ref: 'org-test', ref_core: 'charge-a', valor_centavos: 10000, desconto_centavos: 0 }];
  db.query.mockImplementation(async (sql: string, params: unknown[]) => {
    if (sql.includes('SELECT DISTINCT c.organizacao_ref')) return [charges, []];
    if (sql.includes('SELECT id FROM financeiro_webhooks')) return [events.has(String(params[1])) ? [{ id: params[1] }] : [], []];
    if (sql.includes('FROM financeiro_pagamentos')) return [[...payments.values()], []];
    return [[], []];
  });
  db.execute.mockImplementation(async (sql: string, params: unknown[]) => {
    if (sql.includes('INSERT INTO financeiro_webhooks')) events.add(String(params[2]));
    if (sql.includes('INSERT INTO financeiro_pagamentos')) payments.set(String(params[3]), {
      ref_core: String(params[3]), cobranca_ref: String(params[4]), valor_centavos: Number(params[6]),
    });
    if (sql.includes('UPDATE financeiro_cobrancas SET status')) statuses.set(String(params.at(-1)), String(params[0]));
    if (sql.includes('UPDATE financeiro_checkouts_asaas SET status')) checkoutStatus = String(params[0]);
    return [{ affectedRows: 1 }, []];
  });
});

describe('liquidações sucessivas', () => {
  it('dois Pix de R$ 50 quitam uma cobrança de R$ 100', async () => {
    await pix('end-1', 5000); await pix('end-2', 5000);
    expect([...payments.values()].map((p) => p.valor_centavos)).toEqual([5000, 5000]);
    expect(statuses.get('charge-a')).toBe('paid');
    expect(checkoutStatus).toBe('paid');
  });
  it('o segundo Pix do grupo vai para o saldo da segunda sessão', async () => {
    charges.push({ ...charges[0], ref_core: 'charge-b' });
    await pix('end-1', 15000); await pix('end-2', 5000);
    expect([...payments.values()]).toEqual([
      { ref_core: 'inter-end-1-charge-a', cobranca_ref: 'charge-a', valor_centavos: 10000 },
      { ref_core: 'inter-end-1-charge-b', cobranca_ref: 'charge-b', valor_centavos: 5000 },
      { ref_core: 'inter-end-2-charge-b', cobranca_ref: 'charge-b', valor_centavos: 5000 },
    ]);
    expect([...statuses.values()]).toEqual(['paid', 'paid']);
    expect(checkoutStatus).toBe('paid');
  });
  it('reentrega da mesma liquidação com outro evento não credita novamente', async () => {
    await pix('end-1', 5000); await pix('end-1', 5000, 'other-event');
    expect([...payments.values()]).toHaveLength(1);
    expect([...payments.values()][0].valor_centavos).toBe(5000);
    expect(statuses.get('charge-a')).toBe('partially_paid');
  });
  it('o valor do Asaas é cumulativo: 50 e depois 100 representam R$ 100', async () => {
    await card('confirmed', 5000); await card('received', 10000);
    expect([...payments.values()]).toEqual([{ ref_core: 'asaas-pay-test-charge-a', cobranca_ref: 'charge-a', valor_centavos: 10000 }]);
    expect(statuses.get('charge-a')).toBe('paid');
  });
  it('evento antigo do Asaas não reduz o total já confirmado', async () => {
    await card('received', 10000); await card('old-confirmed', 5000);
    expect([...payments.values()][0].valor_centavos).toBe(10000);
    expect(statuses.get('charge-a')).toBe('paid');
    expect(checkoutStatus).toBe('paid');
  });
});
