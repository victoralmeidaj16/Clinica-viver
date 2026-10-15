import { beforeEach, describe, expect, it, vi } from 'vitest';
vi.mock('server-only', () => ({}));
const db = vi.hoisted(() => ({
  query: vi.fn(), execute: vi.fn(), beginTransaction: vi.fn(), commit: vi.fn(), rollback: vi.fn(), release: vi.fn(),
}));
vi.mock('@/server/oci/runtime', () => ({ getMysqlPool: () => ({ getConnection: async () => db }) }));
vi.mock('@/server/auth', () => ({ hashPassword: () => 'hashed-password' }));
vi.mock('@/server/persistence/mysql/mappers', () => ({ instituicaoId: () => 'clinic', rowId: () => 'row', toSqlTimestamp: (value: string) => value }));
import { createPsychologistPasswordReset, resetPsychologistPassword } from './passwordReset';

describe('tokens de recuperação', () => {
  beforeEach(() => { vi.resetAllMocks(); });

  it('guarda apenas hash e mantém links anteriores em solicitações públicas', async () => {
    db.query.mockResolvedValueOnce([[{ userId: 'user', organizationId: 'org' }]]).mockResolvedValueOnce([[]]);
    const result = await createPsychologistPasswordReset('psi@example.com', true);
    expect(result.token.length).toBeGreaterThan(40);
    expect(JSON.stringify(db.execute.mock.calls)).not.toContain(result.token);
    expect(db.execute).toHaveBeenCalledTimes(1);
    expect(db.execute.mock.calls[0][0]).toContain('INSERT INTO');
    expect(db.commit).toHaveBeenCalled();
  });

  it('aplica intervalo por conta sob transação', async () => {
    db.query.mockResolvedValueOnce([[{ userId: 'user', organizationId: 'org' }]]).mockResolvedValueOnce([[{ id: 'recent' }]]);
    await expect(createPsychologistPasswordReset('psi@example.com', true)).rejects.toMatchObject({ code: 'RESET_COOLDOWN' });
    expect(db.execute).not.toHaveBeenCalled();
    expect(db.rollback).toHaveBeenCalled();
    expect(db.release).toHaveBeenCalled();
  });

  it('preserva revogação dos links anteriores pela gestão', async () => {
    db.query.mockResolvedValueOnce([[{ userId: 'user', organizationId: 'org' }]]);
    await createPsychologistPasswordReset('psi@example.com');
    expect(db.execute.mock.calls[0][0]).toContain('revogado_em');
    expect(db.execute).toHaveBeenCalledTimes(2);
  });

  it('recusa link vencido, consumido ou conta inativa sem trocar a senha', async () => {
    db.query.mockResolvedValueOnce([[]]);
    await expect(resetPsychologistPassword('token', 'senhaForte123')).rejects.toMatchObject({ code: 'INVALID_RESET_TOKEN' });
    expect(db.execute).not.toHaveBeenCalled();
    expect(db.rollback).toHaveBeenCalled();
  });

  it('troca senha, consome token e revoga demais links juntos', async () => {
    db.query.mockResolvedValueOnce([[{ id: 'reset', usuario_ref: 'user', organizacao_ref: 'org' }]]);
    expect(await resetPsychologistPassword('token', 'senhaForte123')).toEqual({ userId: 'user', organizationId: 'org', role: 'psicologo' });
    expect(db.execute.mock.calls[0][1][0]).toBe('hashed-password');
    expect(db.execute.mock.calls[1][0]).toContain('utilizado_em');
    expect(db.execute.mock.calls[2][0]).toContain('revogado_em');
    expect(db.commit).toHaveBeenCalled();
  });

  it('rejeita senha fraca antes de consultar tokens', async () => {
    await expect(resetPsychologistPassword('token', '123')).rejects.toMatchObject({ code: 'WEAK_PASSWORD' });
    expect(db.query).not.toHaveBeenCalled();
  });
});
