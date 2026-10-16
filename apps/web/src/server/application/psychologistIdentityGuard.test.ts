import { describe, expect, it, vi } from 'vitest';
vi.mock('server-only', () => ({}));
import type { CadastroPsicologoRecord } from './persistence';
import { assertEmailsDeCadastroDisponiveis, syncIdentidadeDoCadastro } from './psychologistIdentityGuard';

const candidate = { id: 'psi-1', email: 'psi@example.com', whatsapp: '5548998315675' } as CadastroPsicologoRecord;

describe('contas existentes fora da captação', () => {
  it('bloqueia nova candidatura que usa e-mail já associado a uma conta', async () => {
    const db = { query: vi.fn().mockResolvedValue([[{ ref_core: 'user-1', email_normalizado: candidate.email }]]) };
    await expect(assertEmailsDeCadastroDisponiveis(db as never, [], [candidate])).rejects.toMatchObject({ code: 'CADASTRO_DUPLICADO' });
  });
  it('não confia em vínculo introduzido pelo novo cadastro', async () => {
    const db = { query: vi.fn().mockResolvedValue([[{ ref_core: 'user-1', email_normalizado: candidate.email }]]) };
    await expect(assertEmailsDeCadastroDisponiveis(db as never, [], [{ ...candidate, usuarioRef: 'user-1' }])).rejects.toMatchObject({ code: 'CADASTRO_DUPLICADO' });
  });
  it('permite o titular sincronizar o próprio e-mail e rejeita o de outro usuário', async () => {
    const before = { ...candidate, email: 'antigo@example.com', usuarioRef: 'user-1' };
    const db = { query: vi.fn().mockResolvedValue([[{ ref_core: 'user-1', email_normalizado: candidate.email }]]) };
    await expect(assertEmailsDeCadastroDisponiveis(db as never, [before], [candidate])).resolves.toBeUndefined();
    db.query.mockResolvedValue([[{ ref_core: 'other', email_normalizado: candidate.email }]]);
    await expect(assertEmailsDeCadastroDisponiveis(db as never, [before], [candidate])).rejects.toMatchObject({ code: 'CADASTRO_DUPLICADO' });
  });
});

describe('sincronização da identidade pela transação de cadastro', () => {
  it('atualiza somente o usuário e o profissional vinculados ao cadastro original', async () => {
    const before = { ...candidate, usuarioRef: 'owner', profissionalRef: 'professional', nomeCompleto: 'Nome anterior' };
    const after = { ...before, nomeCompleto: 'Nome atualizado', crp: '12/34567' };
    const db = { execute: vi.fn() };
    await syncIdentidadeDoCadastro(db as never, [before], [after]);
    expect(db.execute).toHaveBeenCalledTimes(2);
    expect(db.execute.mock.calls[0][0]).toContain('WHERE instituicao_id = ? AND ref_core = ?');
    expect(db.execute.mock.calls[0][1].at(-1)).toBe('owner');
    expect(db.execute.mock.calls[1][1].slice(-2)).toEqual(['professional', 'owner']);
  });
  it('recusa atualizar identidade compartilhada antes de qualquer escrita', async () => {
    const before = { ...candidate, usuarioRef: 'shared', nomeCompleto: 'Nome anterior' };
    const after = { ...before, nomeCompleto: 'Nome atualizado' };
    const db = { execute: vi.fn() };
    await expect(syncIdentidadeDoCadastro(db as never, [before], [after, { ...before, id: 'other' }])).rejects.toMatchObject({ code: 'CADASTRO_DUPLICADO' });
    expect(db.execute).not.toHaveBeenCalled();
  });
});
