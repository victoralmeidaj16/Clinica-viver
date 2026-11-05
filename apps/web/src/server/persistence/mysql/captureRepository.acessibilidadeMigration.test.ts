import { expect, it, vi } from 'vitest';
import type { CadastroPsicologoRecord } from '@/server/application/persistence';

vi.mock('server-only', () => ({}));
vi.mock('@/server/application/persistence', () => ({ readSnapshot: () => null }));
vi.mock('@/server/persistence/turmasEncerradas', () => ({ comTurmasEncerradas: async (cadastros: CadastroPsicologoRecord[]) => cadastros }));

import { MysqlCaptureRepository } from './captureRepository';

it('mantém leitura sem a migration, mas impede perder uma resposta de acessibilidade', async () => {
  const connection = { query: vi.fn(async () => [[]]), execute: vi.fn(), beginTransaction: vi.fn(),
    commit: vi.fn(), rollback: vi.fn(), release: vi.fn() };
  const repository = new MysqlCaptureRepository({ ...connection, getConnection: async () => connection } as never);
  expect(await repository.read()).toEqual({ cadastrosPsicologos: [], triagensPacientes: [] });
  await expect(repository.mutate((state) => ({ next: { ...state, cadastrosPsicologos: [{
    id: 'psi-ficticio', nomeCompleto: 'Profissional fictício', crp: '00/00000', whatsapp: '',
    status: 'EM_ANALISE', criadoEm: '2026-11-04T12:00:00Z', acessibilidade: { necessita: true },
  }] }, result: null }))).rejects.toThrow('076_psicologo_acessibilidade.sql');
  expect(connection.execute).not.toHaveBeenCalled();
  expect(connection.rollback).toHaveBeenCalledOnce();
  expect(connection.commit).not.toHaveBeenCalled();
});
