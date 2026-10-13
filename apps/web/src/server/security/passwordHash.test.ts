import { describe, expect, it, vi } from 'vitest';

vi.mock('server-only', () => ({}));

import { hashPassword, verifyPasswordHash } from './passwordHash';

describe('passwordHash', () => {
  it('gera hash scrypt e valida a senha correta', () => {
    const hash = hashPassword('senhaForte123');
    expect(hash).toMatch(/^scrypt\$/);
    expect(verifyPasswordHash('senhaForte123', hash)).toBe(true);
    expect(verifyPasswordHash('senhaErrada123', hash)).toBe(false);
  });

  it('recusa hash ausente ou malformado sem lançar', () => {
    expect(verifyPasswordHash('senhaForte123', '')).toBe(false);
    expect(verifyPasswordHash('senhaForte123', 'scrypt$sem-partes')).toBe(false);
  });
});
