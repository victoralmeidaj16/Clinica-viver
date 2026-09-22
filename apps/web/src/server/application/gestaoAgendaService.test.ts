import { beforeEach, expect, it, vi } from 'vitest';
import type { RequestContext } from './context';
vi.mock('server-only', () => ({}));
vi.mock('./agendaService', () => ({ editAgendaAppointment: vi.fn(async () => ({})) }));
vi.mock('@/server/scheduling/gestaoAgendaRepository', () => ({
  listarAgendaGestao: vi.fn(async () => ({ appointments: [], temMais: false })),
  profissionalDoAgendamentoGestao: vi.fn(async () => 'pro-from-appointment'),
}));
import { getGestaoAgenda, editGestaoAppointment } from './gestaoAgendaService';
import { editAgendaAppointment } from './agendaService';
import { listarAgendaGestao, profissionalDoAgendamentoGestao } from '@/server/scheduling/gestaoAgendaRepository';
const context: RequestContext = {
  actor: { actorType: 'staff', organizationId: 'org-1', userId: 'admin-1', membershipId: 'member-1',
    membershipStatus: 'active', roles: ['admin'] }, correlationId: 'test',
};
beforeEach(() => vi.clearAllMocks());
it.each(['professional', 'billing'] as const)('nega leitura e edição ao perfil %s', async (role) => {
  const denied = { ...context, actor: { ...context.actor, roles: [role] } };
  await expect(getGestaoAgenda(denied)).rejects.toMatchObject({ status: 403 });
  await expect(editGestaoAppointment(denied, 'apt', {})).rejects.toMatchObject({ status: 403 });
  expect(listarAgendaGestao).not.toHaveBeenCalled();
  expect(profissionalDoAgendamentoGestao).not.toHaveBeenCalled();
  expect(editAgendaAppointment).not.toHaveBeenCalled();
});
it.each(['admin', 'owner'] as const)('permite %s sem perfil profissional editar o agendamento da organização', async (role) => {
  const authorized = { ...context, actor: { ...context.actor, roles: [role] } };
  await expect(editGestaoAppointment(authorized, 'apt', { custeadoPelaEmpresa: true }))
    .resolves.toEqual({ updated: true });
  expect(profissionalDoAgendamentoGestao).toHaveBeenCalledWith('org-1', 'apt');
  expect(editAgendaAppointment).toHaveBeenCalledWith({ ...authorized,
    actor: { ...authorized.actor, professionalProfileId: 'pro-from-appointment' } },
  'apt', { custeadoPelaEmpresa: true }, { somenteAgendadas: true });
});
it('não edita referência ausente da organização autenticada', async () => {
  vi.mocked(profissionalDoAgendamentoGestao).mockResolvedValueOnce(null);
  await expect(editGestaoAppointment(context, 'other-org-apt', {})).rejects.toMatchObject({ status: 404 });
  expect(editAgendaAppointment).not.toHaveBeenCalled();
});
it('lista com busca e paginação na organização autenticada', async () => {
  await getGestaoAgenda(context, '  Maria  ', 2);
  expect(listarAgendaGestao).toHaveBeenCalledWith('org-1', 'Maria', 2);
});
it.each([-1, NaN, 1.5])('recusa página inválida %s', async (pagina) => {
  await expect(getGestaoAgenda(context, '', pagina)).rejects.toMatchObject({ status: 400 });
  expect(listarAgendaGestao).not.toHaveBeenCalled();
});

it.each([
  { startsAt: 'invalid', endsAt: '2099-01-01T12:00:00Z' },
  { startsAt: '2099-01-01T12:00:00Z', endsAt: '2099-01-01T11:00:00Z' },
])('rejeita intervalo inválido antes de gravar', async (input) => {
  await expect(editGestaoAppointment(context, 'apt', input)).rejects.toMatchObject({ status: 400 });
  expect(profissionalDoAgendamentoGestao).not.toHaveBeenCalled();
  expect(editAgendaAppointment).not.toHaveBeenCalled();
});
