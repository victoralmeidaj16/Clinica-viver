import { beforeEach, describe, expect, it, vi } from 'vitest';
vi.mock('server-only', () => ({}));
const mocks = vi.hoisted(() => ({ query: vi.fn(), get: vi.fn(), set: vi.fn() }));
vi.mock('next/headers', () => ({ cookies: async () => ({ get: mocks.get, set: mocks.set }) }));
vi.mock('@/server/oci/runtime', () => ({ isMysqlConfigured: () => true, getMysqlPool: () => ({ query: mocks.query }) }));
import { readSession, startSession } from './auth';

const account = { userId: 'user-1', organizationId: 'org', role: 'psicologo' as const };

const activeMembership = [[{ membro_status: 'active', papeis: 'professional', usuario_status: 'active', senha_definida_em: null }]];
/** A revalidação do vínculo responde à parte; as demais consultas são as de cadastro. */
function cadastros(rows: unknown[]) {
  mocks.query.mockImplementation(async (sql: string) => (sql.includes('clinica_membros') ? activeMembership : [rows]));
}

describe('sessão com identidade exclusiva', () => {
  beforeEach(() => vi.resetAllMocks());
  it('não cria sessão de psicólogo com dois cadastros vinculados', async () => {
    mocks.query.mockResolvedValue([[{ ref_core: 'psi-1' }, { ref_core: 'psi-2' }]]);
    await expect(startSession(account)).rejects.toMatchObject({ code: 'AMBIGUOUS_ACCOUNT', status: 409 });
    expect(mocks.set).not.toHaveBeenCalled();
  });
  it('recusa também uma sessão anterior quando o vínculo se torna ambíguo', async () => {
    cadastros([{ ref_core: 'psi-1' }]);
    await startSession(account);
    mocks.get.mockReturnValue({ value: mocks.set.mock.calls[0][1] });
    expect(await readSession()).toMatchObject(account);
    cadastros([{ ref_core: 'psi-1' }, { ref_core: 'psi-2' }]);
    expect(await readSession()).toBeNull();
  });
  it('mantém acesso da gestão para revisar os cadastros', async () => {
    await startSession({ ...account, role: 'admin' });
    expect(mocks.query).not.toHaveBeenCalled();
    expect(mocks.set).toHaveBeenCalled();
  });
});
