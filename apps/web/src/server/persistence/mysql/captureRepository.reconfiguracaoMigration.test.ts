import { expect, it, vi } from 'vitest';
import type { CadastroPsicologoRecord } from '@/server/application/persistence';

vi.mock('server-only', () => ({}));
vi.mock('@/server/application/persistence', () => ({ readSnapshot: () => null }));
vi.mock('@/server/persistence/turmasEncerradas', () => ({ comTurmasEncerradas: async (cadastros: CadastroPsicologoRecord[]) => cadastros }));

import { MysqlCaptureRepository } from './captureRepository';

it('mantém a leitura antes da migration e impede salvar uma troca de pós sem persistir a pendência', async () => {
  const connection = { query: vi.fn(async () => [[]]), execute: vi.fn(), beginTransaction: vi.fn(),
    commit: vi.fn(), rollback: vi.fn(), release: vi.fn() };
  const repository = new MysqlCaptureRepository({ ...connection, getConnection: async () => connection } as never);
  expect(await repository.read()).toEqual({ cadastrosPsicologos: [], triagensPacientes: [] });
  await expect(repository.mutate((state) => ({ next: { ...state, cadastrosPsicologos: [{
    id: 'psi-ficticio', nomeCompleto: 'Profissional fictício', crp: '00/00000', whatsapp: '',
    status: 'APROVADO', criadoEm: '2026-11-05T12:00:00Z', reconfiguracaoAtendimentoPendente: true,
  }] }, result: null }))).rejects.toThrow('078_psicologo_reconfiguracao_atendimento.sql');
  expect(connection.execute).not.toHaveBeenCalled();
  expect(connection.rollback).toHaveBeenCalledOnce();
  expect(connection.commit).not.toHaveBeenCalled();
});
