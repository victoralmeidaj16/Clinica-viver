import { beforeEach, expect, it, vi } from 'vitest';
import type { RequestContext } from '@/server/application/context';
import { resolveRequestContext } from '@/server/application/context';
import { profissionalDoAgendamentoGestao } from '@/server/scheduling/gestaoAgendaRepository';
import { alteracoesDoAgendamento } from '@/server/persistence/mysql/agendamentoAlteracoesRepository';
import { GET } from './route';

vi.mock('server-only', () => ({}));
vi.mock('@/server/application/context', () => ({ resolveRequestContext: vi.fn() }));
vi.mock('@/server/application/agendaService', () => ({}));
vi.mock('@/server/application/convenioService', () => ({}));
vi.mock('@/server/oci/runtime', () => ({ isMysqlConfigured: () => true }));
vi.mock('@/server/scheduling/gestaoAgendaRepository', () => ({ profissionalDoAgendamentoGestao: vi.fn() }));
vi.mock('@/server/persistence/mysql/agendamentoAlteracoesRepository', () => ({ alteracoesDoAgendamento: vi.fn() }));

const context: RequestContext = {
  actor: { actorType: 'staff', organizationId: 'org', userId: 'admin', membershipId: 'member',
    membershipStatus: 'active', roles: ['admin'] }, correlationId: 'test',
};
const get = () => GET(new Request('http://localhost'), { params: Promise.resolve({ id: 'apt' }) });

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(resolveRequestContext).mockResolvedValue(context);
});

it.each(['professional', 'billing'] as const)('recusa o histórico ao perfil %s', async (role) => {
  vi.mocked(resolveRequestContext).mockResolvedValue({ ...context, actor: { ...context.actor, roles: [role] } });
  expect((await get()).status).toBe(403);
  expect(profissionalDoAgendamentoGestao).not.toHaveBeenCalled();
  expect(alteracoesDoAgendamento).not.toHaveBeenCalled();
});

it('protege agendamentos de outra organização', async () => {
  vi.mocked(profissionalDoAgendamentoGestao).mockResolvedValue(null);
  expect((await get()).status).toBe(404);
  expect(alteracoesDoAgendamento).not.toHaveBeenCalled();
});

it('consulta pelo agendamento e organização da sessão validada', async () => {
  vi.mocked(profissionalDoAgendamentoGestao).mockResolvedValue('prof');
  const linha = { id: 'a', agendamentoId: 'apt', profissionalRef: 'prof', alteradoEm: '2026-11-10T12:00:00Z', mudancas: [] };
  vi.mocked(alteracoesDoAgendamento).mockResolvedValue([linha]);
  const resposta = await get();
  expect(resposta.status).toBe(200);
  expect(await resposta.json()).toMatchObject({ ok: true, data: { alteracoes: [linha] } });
  expect(profissionalDoAgendamentoGestao).toHaveBeenCalledWith('org', 'apt');
  expect(alteracoesDoAgendamento).toHaveBeenCalledWith('org', 'apt');
});
