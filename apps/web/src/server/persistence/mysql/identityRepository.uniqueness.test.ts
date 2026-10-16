import { describe, expect, it, vi } from 'vitest';
import type { IdentityUser } from '@thats-life/core';
vi.mock('server-only', () => ({}));
import { MysqlIdentityRepository } from './identityRepository';

const user = { id: 'user-1', displayName: 'Nome próprio', normalizedEmail: 'outra@example.com', status: 'active', createdAt: '2026-10-16T12:00:00Z', updatedAt: '2026-10-16T12:00:00Z' } as IdentityUser;

describe('gravação de identidade sem adoção por e-mail', () => {
  it('atualiza pelo identificador e propaga conflito de e-mail sem fazer upsert de outro usuário', async () => {
    const collision = { code: 'ER_DUP_ENTRY' };
    const db = { query: vi.fn().mockResolvedValue([[{ ref_core: user.id }]]), execute: vi.fn().mockRejectedValue(collision) };
    await expect(new MysqlIdentityRepository(db as never).saveUser(user)).rejects.toEqual(collision);
    const [sql, params] = db.execute.mock.calls[0];
    expect(sql).toContain('UPDATE clinica_usuarios');
    expect(sql).toContain('WHERE instituicao_id = ? AND ref_core = ?');
    expect(params.at(-1)).toBe(user.id);
    expect(db.execute).toHaveBeenCalledTimes(1);
  });
  it('inserção de usuário novo não sobrescreve uma conta pelo índice de e-mail', async () => {
    const db = { query: vi.fn().mockResolvedValue([[]]), execute: vi.fn() };
    await new MysqlIdentityRepository(db as never).saveUser(user);
    expect(db.execute.mock.calls[0][0]).toContain('INSERT INTO clinica_usuarios');
    expect(db.execute.mock.calls[0][0]).not.toContain('ON DUPLICATE KEY');
  });
});
