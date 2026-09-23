import { beforeEach, describe, expect, it, vi } from 'vitest';
vi.mock('server-only', () => ({}));
const state = vi.hoisted(() => ({
  transaction: false,
  job: undefined as undefined | { id: string; plano: string; vence_em: string; situacao: string },
  charges: [] as Record<string, unknown>[], checkouts: [] as Record<string, unknown>[],
  connection: { beginTransaction: vi.fn(), commit: vi.fn(), rollback: vi.fn(), release: vi.fn(), query: vi.fn(), execute: vi.fn() },
}));
vi.mock('@/server/oci/runtime', () => ({ getMysqlPool: () => ({ getConnection: async () => state.connection }) }));
vi.mock('@/server/persistence/mysql/mappers', () => ({ instituicaoId: () => 'inst', toSqlTimestamp: (value: string) => value }));
vi.mock('./sessionChargeCancellation', () => ({ cancelRemote: vi.fn(), remoteCancellationState: vi.fn() }));
import { cancelRemote, remoteCancellationState } from './sessionChargeCancellation';
import { atualizarVencimentoCobrancaSessao } from './sessionChargeDue';
import { processAppointmentChargeDue } from './sessionChargeDueWorker';
const input = { organizationId: 'org', professionalId: 'pro', appointmentId: 'appt', dueAt: '2099-01-01T12:00:00Z' };

beforeEach(() => {
  vi.resetAllMocks();
  state.transaction = false; state.job = undefined;
  state.charges = [{ ref_core: 'charge', organizacao_ref: 'org', status: 'overdue', possui_pagamento: 0 }];
  state.checkouts = [{ id: 'checkout', cobranca_ref: 'other-charge', referencia_externa: 'VM-old',
    provedor: 'asaas', provedor_pagamento_ref: 'pay-1', status: 'pending' }];
  state.connection.beginTransaction.mockImplementation(async () => { state.transaction = true; });
  state.connection.commit.mockImplementation(async () => { state.transaction = false; });
  state.connection.rollback.mockImplementation(async () => { state.transaction = false; });
  state.connection.query.mockImplementation(async (sql: string) => {
    if (sql.includes('GET_LOCK')) return [[{ acquired: 1 }], []];
    if (sql.includes('JSON_CONTAINS')) return [[...(state.job?.situacao === 'pending' ? [state.job] : [])], []];
    if (sql.includes('SELECT id, plano')) return [[...(state.job?.situacao === 'pending' ? [state.job] : [])], []];
    if (sql.includes('SELECT a.id FROM')) return [[{ id: 'appt' }], []];
    if (sql.includes('SELECT c.ref_core')) return [state.charges, []];
    if (sql.includes('SELECT x.id')) return [state.checkouts, []];
    if (sql.includes('SELECT cobranca_ref')) return [[{ cobranca_ref: 'charge' }, { cobranca_ref: 'group-member' }], []];
    return [[], []];
  });
  state.connection.execute.mockImplementation(async (sql: string, values: unknown[]) => {
    if (sql.includes('INSERT INTO financeiro_ajustes')) state.job = {
      id: String(values[0]), vence_em: String(values[3]), plano: String(values[4]), situacao: 'pending',
    };
    if (sql.includes('SET plano =')) state.job!.plano = String(values[0]);
    if (sql.includes('SET situacao =')) state.job!.situacao = String(values[0]);
    return [{ affectedRows: 1 }, []];
  });
  vi.mocked(remoteCancellationState).mockImplementation(async () => { expect(state.transaction).toBe(false); return 'pending'; });
  vi.mocked(cancelRemote).mockImplementation(async () => { expect(state.transaction).toBe(false); return true; });
});
function secondPayment() {
  state.checkouts.push({ ...state.checkouts[0], id: 'checkout-2', referencia_externa: 'VM-2', provedor_pagamento_ref: 'pay-2' });
}

describe('ajuste financeiro após liberar a agenda', () => {
  it('grava a intenção antes de acessar a rede e libera todas as sessões do grupo', async () => {
    expect(await atualizarVencimentoCobrancaSessao(input)).toBe('updated');
    expect(state.job?.situacao).toBe('completed');
    expect(JSON.parse(state.job!.plano).affectedChargeIds).toEqual(['charge', 'other-charge', 'group-member']);
    expect(state.connection.execute).toHaveBeenCalledWith(expect.stringContaining('DELETE FROM financeiro_checkout_cobrancas'), ['inst', 'VM-old']);
    expect(state.connection.execute).toHaveBeenCalledWith(expect.stringContaining('SET vence_em = ?'), [input.dueAt, 'inst', 'org', 'charge']);
    expect(state.connection.commit.mock.invocationCallOrder[0]).toBeLessThan(vi.mocked(cancelRemote).mock.invocationCallOrder[0]);
  });
  it('não cancela nenhum pagamento se o segundo já estiver pago na pré-consulta', async () => {
    secondPayment();
    vi.mocked(remoteCancellationState).mockResolvedValueOnce('pending').mockResolvedValueOnce('paid');
    expect(await atualizarVencimentoCobrancaSessao(input)).toBe('paid');
    expect(cancelRemote).not.toHaveBeenCalled();
    expect(state.job?.situacao).toBe('paid');
  });
  it('preserva a limpeza do primeiro cancelamento se o segundo for pago durante a operação', async () => {
    secondPayment();
    vi.mocked(cancelRemote).mockResolvedValueOnce(true).mockResolvedValueOnce(false);
    expect(await atualizarVencimentoCobrancaSessao(input)).toBe('paid');
    expect(state.connection.execute).toHaveBeenCalledWith(expect.stringContaining('DELETE FROM financeiro_checkout_cobrancas'), ['inst', 'VM-old']);
    expect(JSON.parse(state.job!.plano).remotes).toEqual([{ provider: 'asaas', id: 'pay-2' }]);
    expect(state.connection.commit.mock.invocationCallOrder[1]).toBeLessThan(vi.mocked(cancelRemote).mock.invocationCallOrder[1]);
  });
  it('retoma somente o pagamento restante após falha, sem perder o ajuste pendente', async () => {
    secondPayment();
    vi.mocked(cancelRemote).mockResolvedValueOnce(true).mockRejectedValueOnce(new Error('rede indisponível'));
    const log = vi.spyOn(console, 'error').mockImplementation(() => {});
    expect(await atualizarVencimentoCobrancaSessao(input)).toBe('queued');
    expect(state.job?.situacao).toBe('pending');
    expect(JSON.parse(state.job!.plano).remotes).toEqual([{ provider: 'asaas', id: 'pay-2' }]);
    vi.mocked(cancelRemote).mockClear();
    expect(await processAppointmentChargeDue('appt')).toBe('updated');
    expect(cancelRemote).toHaveBeenCalledExactlyOnceWith('asaas', 'pay-2');
    log.mockRestore();
  });
  it('mantém o trabalho pendente se o checkpoint local falhar após cancelar no provedor', async () => {
    const execute = state.connection.execute.getMockImplementation()!;
    state.connection.execute.mockImplementation(async (sql, values) => {
      if (sql.includes('DELETE FROM financeiro_checkout_cobrancas')) throw new Error('banco indisponível');
      return execute(sql, values);
    });
    const log = vi.spyOn(console, 'error').mockImplementation(() => {});
    expect(await atualizarVencimentoCobrancaSessao(input)).toBe('queued');
    expect(state.job?.situacao).toBe('pending');
    expect(JSON.parse(state.job!.plano).remotes).toHaveLength(1);
    expect(state.connection.rollback).toHaveBeenCalled();
    state.connection.execute.mockImplementation(execute);
    expect(await processAppointmentChargeDue('appt')).toBe('updated');
    log.mockRestore();
  });
  it('limpa remoção já feita numa tentativa anterior mesmo se o segundo pagamento foi liquidado', async () => {
    secondPayment();
    vi.mocked(remoteCancellationState).mockResolvedValueOnce('cancelled').mockResolvedValueOnce('paid');
    expect(await atualizarVencimentoCobrancaSessao(input)).toBe('paid');
    expect(cancelRemote).not.toHaveBeenCalled();
    expect(state.connection.execute).toHaveBeenCalledWith(expect.stringContaining('DELETE FROM financeiro_checkout_cobrancas'), ['inst', 'VM-old']);
    expect(JSON.parse(state.job!.plano).remotes).toEqual([{ provider: 'asaas', id: 'pay-2' }]);
  });
  it('atualiza várias cobranças da sessão usando parâmetros escalares no comando preparado', async () => {
    state.charges.push({ ...state.charges[0], ref_core: 'charge-2' });
    expect(await atualizarVencimentoCobrancaSessao(input)).toBe('updated');
    expect(state.connection.execute).toHaveBeenCalledWith(expect.stringContaining('c.ref_core IN (?, ?)'),
      [input.dueAt, 'inst', 'org', 'charge', 'charge-2']);
  });
  it('preserva pagamento confirmado localmente', async () => {
    state.charges[0].possui_pagamento = 1;
    expect(await atualizarVencimentoCobrancaSessao(input)).toBe('paid');
    expect(cancelRemote).not.toHaveBeenCalled();
    expect(state.connection.execute).not.toHaveBeenCalled();
  });
  it('recusa checkout em emissão antes de salvar a intenção', async () => {
    state.checkouts[0].provedor_pagamento_ref = null;
    await expect(atualizarVencimentoCobrancaSessao(input)).rejects.toThrow('em emissão');
    expect(state.connection.execute).not.toHaveBeenCalled();
  });
  it('recusa agendamento fora do escopo autorizado', async () => {
    state.connection.query.mockResolvedValue([[], []]);
    expect(await atualizarVencimentoCobrancaSessao(input)).toBe('not_found');
    expect(cancelRemote).not.toHaveBeenCalled();
  });
});
