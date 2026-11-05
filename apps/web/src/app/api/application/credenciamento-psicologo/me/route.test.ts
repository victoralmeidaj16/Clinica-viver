import { beforeEach, expect, it, vi } from 'vitest';

vi.mock('server-only', () => ({}));
const state = vi.hoisted(() => ({ mutate: vi.fn(), notice: vi.fn() }));
vi.mock('@/server/auth', () => ({ readSession: async () => ({ userId: 'user', organizationId: 'org' }) }));
vi.mock('@/server/application/psychologistSelf', () => ({
  SemAcessoError: class SemAcessoError extends Error {},
  cadastroDaSessao: async () => ({ id: 'psi', usuarioRef: 'user', nomeCompleto: 'Antes', status: 'APROVADO', pausadoNoRodizio: false }),
}));
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

it.each(['APROVADO', 'RECUSADO'])('impede o psicólogo de registrar a decisão %s', async (status) => {
  const response = await PATCH(new Request('http://localhost/api/application/credenciamento-psicologo/me', {
    method: 'PATCH', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ solicitacaoAlteracaoGestao: { status, solicitadoEm: '2026-09-06T12:00:00.000Z' } }),
  }));
  expect(response.status).toBe(400);
  expect(state.mutate).not.toHaveBeenCalled();
});

it.each([
  { status: 'PENDENTE', solicitadoEm: '2026-09-06T12:00:00.000Z' },
  null,
])('permite enviar ou cancelar a solicitação', async (solicitacaoAlteracaoGestao) => {
  const response = await PATCH(new Request('http://localhost/api/application/credenciamento-psicologo/me', {
    method: 'PATCH', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ solicitacaoAlteracaoGestao }),
  }));
  expect(response.status).toBe(200);
  expect(state.mutate).toHaveBeenCalledOnce();
});
