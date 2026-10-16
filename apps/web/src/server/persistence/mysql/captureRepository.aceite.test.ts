import { describe, expect, it, vi } from 'vitest';

vi.mock('server-only', () => ({}));

import { MysqlCaptureRepository } from './captureRepository';
import type { CadastroPsicologoRecord } from '@/server/application/persistence';

const psicologo: CadastroPsicologoRecord = {
  id: 'psi-teste',
  nomeCompleto: 'Profissional de teste',
  crp: '00/00000',
  whatsapp: '',
  status: 'EM_ANALISE',
  criadoEm: '2026-10-15T17:32:10.000Z',
  aceiteTermoAdesao: {
    versao: '2026.2',
    aceitoEm: '2026-10-15T17:32:10.000Z',
    ip: '203.0.113.7',
    hashAlgoritmo: 'SHA-256',
    hashTexto: 'a'.repeat(64),
  },
} as CadastroPsicologoRecord;

function conexao(colunaExiste: boolean) {
  return {
    query: vi.fn(async (_sql: string) => [colunaExiste ? [{ 1: 1 }] : []]),
    execute: vi.fn(async (_sql: string, _params?: unknown[]) => [{}]),
  };
}

type ComWriteState = { writeState(connection: unknown, state: unknown): Promise<void> };

function repositorio(conn: ReturnType<typeof conexao>): ComWriteState {
  return new MysqlCaptureRepository(conn as never) as unknown as ComWriteState;
}

describe('gravação da prova do aceite', () => {
  it('grava a prova uma única vez, sem sobrescrever a existente', async () => {
    const conn = conexao(true);
    await repositorio(conn).writeState(conn, {
      triagensPacientes: [],
      cadastrosPsicologos: [psicologo],
    });

    const update = conn.execute.mock.calls.find(([sql]) => String(sql).includes('SET aceite_termo_adesao'));
    expect(update?.[0]).toContain('aceite_termo_adesao IS NULL');
    expect(JSON.parse(String(update?.[1]?.[0]))).toMatchObject({ ip: '203.0.113.7', versao: '2026.2' });
  });

  it('não toca na coluna enquanto a migração não chegou ao banco', async () => {
    (MysqlCaptureRepository as unknown as { hasAceiteTermoColumn: boolean }).hasAceiteTermoColumn = false;
    const conn = conexao(false);
    await repositorio(conn).writeState(conn, {
      triagensPacientes: [],
      cadastrosPsicologos: [psicologo],
    });

    expect(conn.execute.mock.calls.some(([sql]) => String(sql).includes('aceite_termo_adesao'))).toBe(false);
  });
});

describe('registro do envio do comprovante', () => {
  it('anota só o envio, sem regravar a prova', async () => {
    (MysqlCaptureRepository as unknown as { hasAceiteTermoColumn: boolean }).hasAceiteTermoColumn = false;
    const conn = conexao(true);
    await new MysqlCaptureRepository(conn as never).registrarEnvioComprovanteTermo('psi-teste', {
      situacao: 'enviada',
      tentadoEm: '2026-10-15T17:32:11.000Z',
    });

    const [sql, params] = conn.execute.mock.calls[0];
    expect(sql).toContain("JSON_SET(aceite_termo_adesao, '$.envioComprovante'");
    expect(sql).toContain('aceite_termo_adesao IS NOT NULL');
    expect(JSON.parse(String(params?.[0]))).toEqual({ situacao: 'enviada', tentadoEm: '2026-10-15T17:32:11.000Z' });
  });
});
