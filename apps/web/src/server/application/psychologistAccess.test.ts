import { beforeEach, describe, expect, it, vi } from 'vitest';
vi.mock('server-only', () => ({}));
const db = vi.hoisted(() => ({ query: vi.fn(), execute: vi.fn(), beginTransaction: vi.fn(), commit: vi.fn(), rollback: vi.fn(), release: vi.fn() }));
vi.mock('@/server/oci/runtime', () => ({ getMysqlPool: () => ({ getConnection: async () => db }) }));
vi.mock('@/server/auth', () => ({ hashPassword: () => 'hash' }));
vi.mock('@/server/persistence/mysql/mappers', () => ({ instituicaoId: () => 'clinic', rowId: (_kind: string, id: string) => id, toSqlTimestamp: (value: string) => value }));
import { provisionPsychologistAccess } from './psychologistAccess';
import { CadastroDuplicadoError } from './psychologistUniqueness';
import type { CadastroPsicologoRecord } from './persistence';

const cadastro = { id: 'psi-2', nomeCompleto: 'Segunda pessoa', crp: '12/34567', email: 'psi@example.com', whatsapp: '5548998315675', estadoUf: 'SC', cidade: 'Florianópolis', genero: 'FEMININO', status: 'APROVADO' } as CadastroPsicologoRecord;

describe('identidade exclusiva no provisionamento', () => {
  beforeEach(() => vi.resetAllMocks());
  function setup(registrations: CadastroPsicologoRecord[], user?: object, professional?: object) {
    db.query.mockResolvedValueOnce([[{ id: 'org' }]])
      .mockResolvedValueOnce([registrations])
      .mockResolvedValueOnce([user ? [user] : []])
      .mockResolvedValueOnce([professional ? [professional] : []]);
  }
  it('bloqueia segundo cadastro do mesmo e-mail antes de qualquer escrita', async () => {
    setup([cadastro, { ...cadastro, id: 'psi-1', usuarioRef: 'user-1' }]);
    await expect(provisionPsychologistAccess(cadastro)).rejects.toBeInstanceOf(CadastroDuplicadoError);
    expect(db.execute).not.toHaveBeenCalled();
    expect(db.rollback).toHaveBeenCalled();
  });
  it('não adota conta existente de outro cadastro mesmo sem duplicidade na captação', async () => {
    setup([cadastro], { ref_core: 'user-outro', status: 'active', senha_hash: 'hash' });
    await expect(provisionPsychologistAccess(cadastro)).rejects.toBeInstanceOf(CadastroDuplicadoError);
    expect(db.execute).not.toHaveBeenCalled();
  });
  it('não confia no usuarioRef fornecido pelo chamador', async () => {
    setup([cadastro], { ref_core: 'user-outro', status: 'active', senha_hash: 'hash' });
    await expect(provisionPsychologistAccess({ ...cadastro, usuarioRef: 'user-outro' })).rejects.toBeInstanceOf(CadastroDuplicadoError);
    expect(db.execute).not.toHaveBeenCalled();
  });
  it('bloqueia vínculo compartilhado mesmo após corrigir os contatos', async () => {
    const vinculado = { ...cadastro, usuarioRef: 'shared' };
    setup([vinculado, { ...cadastro, id: 'psi-1', email: 'outra@example.com', whatsapp: '5511987654321', usuarioRef: 'shared' }]);
    await expect(provisionPsychologistAccess(vinculado)).rejects.toBeInstanceOf(CadastroDuplicadoError);
    expect(db.execute).not.toHaveBeenCalled();
  });
  it('cria acesso novo com contatos exclusivos', async () => {
    setup([cadastro]);
    await expect(provisionPsychologistAccess(cadastro)).resolves.toMatchObject({ userId: 'user-psi-2', professionalId: 'professional-psi-2', activationToken: expect.any(String) });
    expect(db.commit).toHaveBeenCalled();
  });
  it('mantém reenvio legítimo da mesma conta ativa sem criar token', async () => {
    const vinculado = { ...cadastro, usuarioRef: 'user-2', profissionalRef: 'pro-2' };
    setup([vinculado], { ref_core: 'user-2', status: 'active', senha_hash: 'hash' }, { ref_core: 'pro-2' });
    const result = await provisionPsychologistAccess(vinculado);
    expect(result).toMatchObject({ userId: 'user-2', professionalId: 'pro-2' });
    expect(result.activationToken).toBeUndefined();
    expect(db.commit).toHaveBeenCalled();
  });
});
