import { describe, expect, it, vi } from 'vitest';
const mocks = vi.hoisted(() => ({ query: vi.fn(), cancel: vi.fn(), rollback: vi.fn(), execute: vi.fn(), connectionQuery: vi.fn(), connectionExecute: vi.fn() }));
vi.mock('server-only', () => ({}));
vi.mock('@/server/oci/runtime', () => ({ getMysqlPool: () => ({ query: mocks.query, execute: mocks.execute, getConnection: async () => ({ beginTransaction: async () => {}, query: mocks.connectionQuery, execute: mocks.connectionExecute, commit: async () => {}, rollback: mocks.rollback, release: () => {} }) }) }));
vi.mock('@/server/persistence/mysql/mappers', () => ({ instituicaoId: () => 'inst-1', rowId: (_: string, id: string) => id }));
vi.mock('./sessionChargeCancellation', () => ({ cancelarCobrancaDaSessao: mocks.cancel }));
import { transferirCobrancasParaEmpresa } from './convenioChargeTransfer';

describe('transferência de cobrança para empresa', () => {
  it('mantém a transferência pendente quando falha após cancelar a cobrança individual', async () => {
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
});
