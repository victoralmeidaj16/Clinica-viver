import { beforeEach, describe, expect, it, vi } from 'vitest';
vi.mock('server-only', () => ({}));
const mocks = vi.hoisted(() => ({ read: vi.fn(), mutate: vi.fn(), getUser: vi.fn() }));
vi.mock('@/server/application/store', () => ({ getApplicationStore: () => ({ identities: {
  findMembershipByUser: async () => ({ status: 'active', roles: ['professional'] }), getUser: mocks.getUser,
} }) }));
vi.mock('@/server/persistence/captureRepository', () => ({ getCaptureRepository: () => ({ read: mocks.read, mutate: mocks.mutate }) }));
import { cadastroDaSessao } from './psychologistSelf';
import type { AuthSession } from '@/server/auth';

const session = { userId: 'user', organizationId: 'org', role: 'psicologo' } as AuthSession;
describe('resolução exclusiva do próprio cadastro', () => {
  beforeEach(() => vi.resetAllMocks());
  it('não escolhe o primeiro de dois cadastros do mesmo usuário', async () => {
    mocks.read.mockResolvedValue({ cadastrosPsicologos: [{ id: '1', usuarioRef: 'user' }, { id: '2', usuarioRef: 'user' }] });
    await expect(cadastroDaSessao(session)).rejects.toMatchObject({ status: 409 });
    expect(mocks.mutate).not.toHaveBeenCalled();
  });
  it('não adota cadastro já pertencente a outro usuário pelo e-mail', async () => {
    mocks.read.mockResolvedValue({ cadastrosPsicologos: [{ id: '1', usuarioRef: 'other', email: 'psi@example.com' }] });
    mocks.getUser.mockResolvedValue({ normalizedEmail: 'psi@example.com' });
    await expect(cadastroDaSessao(session)).rejects.toMatchObject({ status: 409 });
    expect(mocks.mutate).not.toHaveBeenCalled();
  });
  it('devolve o único cadastro associado à sessão', async () => {
    const cadastro = { id: '1', usuarioRef: 'user' };
    mocks.read.mockResolvedValue({ cadastrosPsicologos: [cadastro] });
    expect(await cadastroDaSessao(session)).toEqual(cadastro);
  });
});
