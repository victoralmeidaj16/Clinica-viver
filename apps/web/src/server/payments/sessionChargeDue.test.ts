import { beforeEach, describe, expect, it, vi } from 'vitest';
vi.mock('server-only', () => ({}));
const { connection } = vi.hoisted(() => ({ connection: {
  beginTransaction: vi.fn(), commit: vi.fn(), rollback: vi.fn(), release: vi.fn(),
  query: vi.fn(), execute: vi.fn<(sql: string, values: unknown[]) => Promise<unknown>>(async () => [{ affectedRows: 1 }, []]),
} }));
vi.mock('@/server/oci/runtime', () => ({ getMysqlPool: () => ({ getConnection: async () => connection }) }));
vi.mock('@/server/persistence/mysql/mappers', () => ({ instituicaoId: () => 'inst', toSqlTimestamp: (value: string) => value }));
vi.mock('./sessionChargeCancellation', () => ({ cancelRemote: vi.fn(async () => true) }));
import { cancelRemote } from './sessionChargeCancellation';
import { atualizarVencimentoCobrancaSessao } from './sessionChargeDue';
const input = { organizationId: 'org', professionalId: 'pro', appointmentId: 'appt', dueAt: '2099-01-01T12:00:00Z' };
let charge: Record<string, unknown>;
let checkout: Record<string, unknown>;
beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(cancelRemote).mockResolvedValue(true);
  charge = { ref_core: 'charge', organizacao_ref: 'org', status: 'overdue', possui_pagamento: 0 };
  checkout = { id: 'checkout', referencia_externa: 'VM-old', provedor: 'inter', provedor_pagamento_ref: 'pix', status: 'pending' };
  connection.query.mockImplementation(async (sql: string) => {
    if (sql.includes('SELECT a.id FROM')) return [[{ id: 'appt' }], []];
    if (sql.includes('SELECT c.ref_core')) return [[charge], []];
    if (sql.includes('SELECT x.id')) return [[checkout], []];
    return [[], []];
  });
});
describe('alteração do vencimento de sessão agrupada', () => {
  it('cancela o pagamento, remove todos os vínculos antigos e reabre a cobrança', async () => {
    expect(await atualizarVencimentoCobrancaSessao(input)).toBe('updated');
    expect(cancelRemote).toHaveBeenCalledWith('inter', 'pix');
    expect(connection.execute).toHaveBeenCalledWith(expect.stringContaining('DELETE FROM financeiro_checkout_cobrancas'), ['inst', 'VM-old']);
    expect(connection.execute).toHaveBeenCalledWith(expect.stringContaining("status = 'pending'"), [input.dueAt, 'inst', 'org', 'charge']);
    expect(connection.commit).toHaveBeenCalledOnce();
    expect(vi.mocked(cancelRemote).mock.invocationCallOrder[0]).toBeLessThan(connection.execute.mock.invocationCallOrder[0]);
  });
  it('encontra o checkout mesmo quando a sessão é membro e não titular', async () => {
    expect(await atualizarVencimentoCobrancaSessao(input)).toBe('updated');
    const query = connection.query.mock.calls.find(([sql]) => sql.includes('SELECT x.id'))!;
    expect(query[0]).toContain('SELECT m.referencia_externa FROM financeiro_checkout_cobrancas');
    expect(query[1]).toEqual(['inst', 'org', ['charge'], 'inst', ['charge']]);
  });
  it('não grava se o provedor falhar', async () => {
    vi.mocked(cancelRemote).mockRejectedValue(new Error('indisponível'));
    await expect(atualizarVencimentoCobrancaSessao(input)).rejects.toThrow('indisponível');
    expect(connection.execute).not.toHaveBeenCalled();
    expect(connection.rollback).toHaveBeenCalledOnce();
  });
  it('preserva grupo pago no provedor', async () => {
    vi.mocked(cancelRemote).mockResolvedValue(false);
    expect(await atualizarVencimentoCobrancaSessao(input)).toBe('paid');
    expect(connection.execute).not.toHaveBeenCalled();
  });
  it('preserva pagamento confirmado localmente', async () => {
    charge.possui_pagamento = 1;
    expect(await atualizarVencimentoCobrancaSessao(input)).toBe('paid');
    expect(cancelRemote).not.toHaveBeenCalled();
    expect(connection.execute).not.toHaveBeenCalled();
  });
  it('recusa checkout em emissão', async () => {
    checkout.provedor_pagamento_ref = null;
    await expect(atualizarVencimentoCobrancaSessao(input)).rejects.toThrow('em emissão');
    expect(connection.execute).not.toHaveBeenCalled();
  });
  it('recusa agendamento fora do escopo autorizado', async () => {
    connection.query.mockResolvedValue([[], []]);
    expect(await atualizarVencimentoCobrancaSessao(input)).toBe('not_found');
    expect(cancelRemote).not.toHaveBeenCalled();
  });
});
