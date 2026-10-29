import { describe, expect, it, vi } from 'vitest';
const mocks = vi.hoisted(() => ({ query: vi.fn(), cancel: vi.fn(), rollback: vi.fn(), execute: vi.fn(), connectionQuery: vi.fn(), connectionExecute: vi.fn(), lockQuery: vi.fn() }));
vi.mock('server-only', () => ({}));
vi.mock('@/server/oci/runtime', () => ({ getMysqlPool: () => ({ query: mocks.query, execute: mocks.execute, getConnection: async () => ({ beginTransaction: async () => {}, query: (sql: string, ...args: unknown[]) => sql.includes('GET_LOCK') || sql.includes('RELEASE_LOCK') || sql.startsWith('SELECT custeado_pela_empresa') ? mocks.lockQuery(sql, ...args) : mocks.connectionQuery(sql, ...args), execute: mocks.connectionExecute, commit: async () => {}, rollback: mocks.rollback, release: () => {} }) }) }));
vi.mock('@/server/persistence/mysql/mappers', () => ({ instituicaoId: () => 'inst-1', rowId: (_: string, id: string) => id }));
vi.mock('./sessionChargeCancellation', () => ({ cancelarCobrancaDaSessao: mocks.cancel }));
import { transferirCobrancasParaEmpresa } from './convenioChargeTransfer';

describe('transferência de cobrança para empresa', () => {
  it('mantém a transferência pendente quando falha após cancelar a cobrança individual', async () => {
    mocks.lockQuery.mockImplementation(async (sql: string) => sql.includes('GET_LOCK') ? [[{ acquired: 1 }], []] : [[{ custeado_pela_empresa: 0 }], []]);
    mocks.query.mockResolvedValueOnce([[{ id: 'a1' }], []]).mockResolvedValueOnce([[{ custeado: 1 }], []]).mockResolvedValueOnce([[{ id: 'a1' }], []]);
    mocks.execute.mockResolvedValue([{ affectedRows: 1 }, []]);
    mocks.cancel.mockResolvedValue('cancelled');
    mocks.connectionQuery.mockResolvedValue([[{ status: 'realizado', sessao_clinica_ref: 's1', valor_centavos: 10000, inicio: '2026-10-01T12:00:00Z' }], []]);
    mocks.connectionExecute.mockRejectedValue(new Error('falha fictícia'));
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {});
    try {
      expect(await transferirCobrancasParaEmpresa('org-1', 'patient-1')).toEqual({ transferidas: 0, mantidas: 0, pendentes: 1 });
      expect(mocks.execute).toHaveBeenCalledBefore(mocks.cancel);
      expect(mocks.rollback).toHaveBeenCalledOnce();
      expect(mocks.query.mock.calls[0][0]).toContain('a.transferencia_convenio_ref IS NOT NULL OR EXISTS');
    } finally { spy.mockRestore(); }
  });

  it('não cancela nem cria outra cobrança quando a sessão já foi transferida', async () => {
    vi.clearAllMocks();
    mocks.query.mockResolvedValueOnce([[{ id: 'a3' }], []]);
    mocks.lockQuery.mockImplementation(async (sql: string) => sql.includes('GET_LOCK') ? [[{ acquired: 1 }], []] : [[{ custeado_pela_empresa: 1 }], []]);
    expect(await transferirCobrancasParaEmpresa('org-1', 'patient-1')).toEqual({ transferidas: 1, mantidas: 0, pendentes: 0 });
    expect(mocks.cancel).not.toHaveBeenCalled();
    expect(mocks.connectionExecute).not.toHaveBeenCalled();
  });

  it('serializa duas transferências simultâneas da mesma sessão', async () => {
    vi.clearAllMocks();
    let tail = Promise.resolve();
    const releases: Array<() => void> = [];
    let transferred = false;
    mocks.lockQuery.mockImplementation(async (sql: string) => {
      if (sql.includes('GET_LOCK')) {
        const previous = tail;
        tail = new Promise<void>((resolve) => { releases.push(resolve); });
        await previous;
        return [[{ acquired: 1 }], []];
      }
      if (sql.includes('RELEASE_LOCK')) { releases.shift()?.(); return [[], []]; }
      return [[{ custeado_pela_empresa: transferred ? 1 : 0 }], []];
    });
    mocks.query.mockImplementation(async (sql: string) => sql.includes('SELECT a.id\n')
      ? [[{ id: 'a4' }], []] : sql.includes('AS custeado') ? [[{ custeado: 1 }], []] : [[{ id: 'a4' }], []]);
    mocks.execute.mockResolvedValue([{ affectedRows: 1 }, []]);
    mocks.cancel.mockResolvedValue('cancelled');
    mocks.connectionQuery.mockResolvedValue([[{ status: 'realizado', sessao_clinica_ref: 's1', valor_centavos: 10000, inicio: '2026-10-01T12:00:00Z' }], []]);
    mocks.connectionExecute.mockImplementation(async (sql: string) => {
      if (sql.includes('SET custeado_pela_empresa = 1')) transferred = true;
      return [{ affectedRows: 1 }, []];
    });
    await Promise.all([transferirCobrancasParaEmpresa('org-1', 'patient-1'), transferirCobrancasParaEmpresa('org-1', 'patient-1')]);
    expect(mocks.cancel).toHaveBeenCalledOnce();
    expect(mocks.connectionExecute.mock.calls.filter(([sql]) => String(sql).includes('INSERT INTO financeiro_cobrancas'))).toHaveLength(1);
  });
});
