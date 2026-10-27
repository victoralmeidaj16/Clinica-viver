import { expect, it, vi } from 'vitest';
vi.mock('server-only', () => ({}));
import { MysqlCaptureRepository, type CaptureState } from './captureRepository';
import type { CadastroPsicologoRecord } from '@/server/application/persistence';
import { CadastroDuplicadoError } from '@/server/application/psychologistUniqueness';

it('verifica duplicidade sob o lock, sem gravar cadastro nem commit em conflito', async () => {
  const db = { query: vi.fn(), beginTransaction: vi.fn(), commit: vi.fn(), rollback: vi.fn(), release: vi.fn() };
  const repo = new MysqlCaptureRepository({ getConnection: async () => db } as never);
  const internal = repo as unknown as { readState: () => Promise<CaptureState>; importLegacyIfNeeded: (_db: unknown, state: CaptureState) => Promise<CaptureState>; writeState: () => Promise<void> };
  const existing = { id: 'psi-1', email: 'psi@example.com', whatsapp: '5548998315675' } as CadastroPsicologoRecord;
  vi.spyOn(internal, 'readState').mockResolvedValue({ triagensPacientes: [], cadastrosPsicologos: [existing] });
  vi.spyOn(internal, 'importLegacyIfNeeded').mockImplementation(async (_db, state) => state);
  const write = vi.spyOn(internal, 'writeState').mockResolvedValue();
  await expect(repo.mutate((state) => ({ next: { ...state, cadastrosPsicologos: [...state.cadastrosPsicologos, { ...existing, id: 'psi-2' }] }, result: null }))).rejects.toBeInstanceOf(CadastroDuplicadoError);
  expect(db.query).toHaveBeenCalledWith(expect.stringContaining('FOR UPDATE'), expect.any(Array));
  expect(write).not.toHaveBeenCalled();
  expect(db.commit).not.toHaveBeenCalled();
  expect(db.rollback).toHaveBeenCalled();
  expect(db.release).toHaveBeenCalled();
});

it('desfaz as escritas do cadastro quando a operação compartilhada falha', async () => {
  const db = { query: vi.fn(), execute: vi.fn(), beginTransaction: vi.fn(), commit: vi.fn(), rollback: vi.fn(), release: vi.fn() };
  const repo = new MysqlCaptureRepository({ getConnection: async () => db } as never);
  const internal = repo as unknown as { readState: () => Promise<CaptureState>; importLegacyIfNeeded: (_db: unknown, state: CaptureState) => Promise<CaptureState> };
  vi.spyOn(internal, 'readState').mockResolvedValue({ triagensPacientes: [], cadastrosPsicologos: [] });
  vi.spyOn(internal, 'importLegacyIfNeeded').mockImplementation(async (_db, state) => state);
  await expect(repo.mutateAtomic(async (_state, connection) => {
    await connection.execute('INSERT fictício');
    throw new Error('falha no contato');
  })).rejects.toThrow('falha no contato');
  expect(db.rollback).toHaveBeenCalledOnce();
  expect(db.commit).not.toHaveBeenCalled();
});
