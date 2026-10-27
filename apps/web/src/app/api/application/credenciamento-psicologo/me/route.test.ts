import { beforeEach, expect, it, vi } from 'vitest';

vi.mock('server-only', () => ({}));
const state = vi.hoisted(() => ({ mutate: vi.fn(), notice: vi.fn() }));
vi.mock('@/server/auth', () => ({ readSession: async () => ({ userId: 'user', organizationId: 'org' }) }));
vi.mock('@/server/application/psychologistSelf', () => ({ cadastroDaSessao: async () => ({ id: 'psi', usuarioRef: 'user', nomeCompleto: 'Antes', status: 'APROVADO', pausadoNoRodizio: false }) }));
vi.mock('@/server/persistence/captureRepository', () => ({ getCaptureRepository: () => ({ mutate: state.mutate }) }));
vi.mock('@/server/persistence/perfilAlteracoes', () => ({ getPerfilAlteracoesRepository: () => ({ registrar: state.notice }) }));
vi.mock('@/server/oci/runtime', () => ({ isMysqlConfigured: () => true }));
import { PATCH } from './route';

beforeEach(() => {
  vi.clearAllMocks();
  state.mutate.mockImplementation(async (mutator) => mutator({ triagensPacientes: [], cadastrosPsicologos: [{
    id: 'psi', usuarioRef: 'user', nomeCompleto: 'Antes', status: 'APROVADO', pausadoNoRodizio: true, exibirNaVitrine: false,
  }] }).result);
});

it('preserva a pausa da gestão feita depois da leitura inicial do cadastro', async () => {
  const response = await PATCH(new Request('http://localhost/api/application/credenciamento-psicologo/me', {
    method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ nomeCompleto: 'Nome atualizado' }),
  }));
  const body = await response.json();
  expect(body.data).toMatchObject({ nomeCompleto: 'Nome atualizado', pausadoNoRodizio: true, exibirNaVitrine: false });
});
