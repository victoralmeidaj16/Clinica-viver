import { beforeEach, describe, expect, it, vi } from 'vitest';
import { listEducationalCreditLines } from '@thats-life/core';
vi.mock('server-only', () => ({}));
const db = vi.hoisted(() => ({ query: vi.fn(), execute: vi.fn(), beginTransaction: vi.fn(), commit: vi.fn(), rollback: vi.fn(), release: vi.fn() }));
vi.mock('@/server/oci/runtime', () => ({ getMysqlPool: () => ({ getConnection: async () => db }) }));
vi.mock('@/server/persistence/mysql/mappers', () => ({ instituicaoId: () => 'inst-test', rowId: (_p: string, ref: string) => ref, toSqlTimestamp: (v: string) => v }));
import { reconcileInterPix, reconcileAsaasPayment } from './paymentLinkRepository';

type Payment = { ref_core: string; cobranca_ref: string; valor_centavos: number; recebido_em: string; status: 'confirmed' | 'cancelled' };
let payments: Map<string, Payment>;
let events: Set<string>;
let charges: Array<{ organizacao_ref: string; ref_core: string; valor_centavos: number; desconto_centavos: number }>;
let statuses: Map<string, string>;
let checkoutStatus: string;
const when = '2026-10-28T12:00:00Z';
const pix = (id: string, amountCents: number, eventId = id) => reconcileInterPix({ eventId, txid: 'tx-test', endToEndId: id, amountCents, receivedAt: when });
const card = (eventId: string, amountCents: number, receivedAt = when) => reconcileAsaasPayment({ eventId, paymentId: 'pay-test', amountCents,
  receivedAt, eventType: 'PAYMENT_RECEIVED', billingType: 'CREDIT_CARD' });

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
      ref_core: String(params[3]), cobranca_ref: String(params[4]),
      recebido_em: String(params[5]), valor_centavos: Number(params[6]), status: 'confirmed',
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
    expect([...payments.values()]).toMatchObject([
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
  it('preserva cada parcela e competência quando o Asaas informa total acumulado (§§ 9.04, 11.02 e 11.07)', async () => {
    const outubro = '2026-10-20T15:00:00Z';
    const novembro = '2026-11-05T15:00:00Z';
    await card('confirmed-oct', 4000, outubro);
    await card('received-nov', 10000, novembro);
    await card('duplicate-nov', 10000, '2026-12-01T15:00:00Z');
    await card('old-smaller', 5000, '2026-12-02T15:00:00Z');

    const gravados = [...payments.values()];
    expect(gravados).toEqual([
      { ref_core: 'asaas-pay-test-charge-a', cobranca_ref: 'charge-a', valor_centavos: 4000, recebido_em: outubro, status: 'confirmed' },
      { ref_core: 'asaas-pay-test-charge-a:2', cobranca_ref: 'charge-a', valor_centavos: 6000, recebido_em: novembro, status: 'confirmed' },
    ]);
    expect(statuses.get('charge-a')).toBe('paid');
    expect(checkoutStatus).toBe('paid');

    const ledger = {
      charges: [{
        id: 'charge-a', organizationId: 'org-test', sessionId: 'sess-a', patientId: 'pat-a',
        professionalId: 'pro-a', amountCents: 10000, status: 'paid' as const,
        issuedAt: outubro, dueAt: outubro, createdAt: outubro, updatedAt: novembro,
      }],
      discounts: [],
      payments: gravados.map((p) => ({
        id: p.ref_core, chargeId: p.cobranca_ref, receivedAt: p.recebido_em,
        amountCents: p.valor_centavos, method: 'card' as const, status: 'confirmed' as const,
      })),
      refunds: [], fees: [], transfers: [],
    };
    const creditoOut = listEducationalCreditLines(ledger, { startDate: '2026-10-01T00:00:00-03:00', endDate: '2026-10-31T23:59:59.999-03:00' });
    const creditoNov = listEducationalCreditLines(ledger, { startDate: '2026-11-01T00:00:00-03:00', endDate: '2026-11-30T23:59:59.999-03:00' });
    expect(creditoOut.map((c) => c.creditCents)).toEqual([2800]);
    expect(creditoNov.map((c) => c.creditCents)).toEqual([4200]);
  });
  it('distribui acumulado do Asaas entre sessões do mesmo checkout sem alterar parcela anterior', async () => {
    charges.push({ ...charges[0], ref_core: 'charge-b' });
    const outubro = '2026-10-20T15:00:00Z';
    const novembro = '2026-11-05T15:00:00Z';
    await card('ev-1', 4000, outubro);
    await card('ev-2', 15000, novembro);

    expect([...payments.values()]).toMatchObject([
      { ref_core: 'asaas-pay-test-charge-a', cobranca_ref: 'charge-a', valor_centavos: 4000, recebido_em: outubro },
      { ref_core: 'asaas-pay-test-charge-a:2', cobranca_ref: 'charge-a', valor_centavos: 6000, recebido_em: novembro },
      { ref_core: 'asaas-pay-test-charge-b', cobranca_ref: 'charge-b', valor_centavos: 5000, recebido_em: novembro },
    ]);
    expect(statuses.get('charge-a')).toBe('paid');
    expect(statuses.get('charge-b')).toBe('partially_paid');
    expect(checkoutStatus).toBe('pending');
  });
  it('ignora parcelas canceladas ao calcular saldo e escolhe nova chave sem colisão', async () => {
    payments.set('asaas-pay-test-charge-a', {
      ref_core: 'asaas-pay-test-charge-a', cobranca_ref: 'charge-a',
      valor_centavos: 4000, recebido_em: '2026-10-10T15:00:00Z', status: 'cancelled',
    });
    await card('ev-nova', 10000, '2026-11-05T15:00:00Z');
    expect(payments.get('asaas-pay-test-charge-a:2')).toMatchObject({
      valor_centavos: 10000, status: 'confirmed',
    });
    expect(statuses.get('charge-a')).toBe('paid');
  });
});
