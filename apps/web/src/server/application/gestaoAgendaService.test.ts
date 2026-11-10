import { beforeEach, expect, it, vi } from 'vitest';
import type { RequestContext } from './context';
vi.mock('server-only', () => ({}));
vi.mock('./agendaService', () => ({
  editAgendaAppointment: vi.fn(async () => ({})),
  updateAgendaAppointmentChargeDue: vi.fn(async () => ({})),
}));
vi.mock('./convenioService', () => ({ updatePatientConvenio: vi.fn(async () => ({ cobrancasPendentes: 0 })) }));
vi.mock('@/server/scheduling/gestaoAgendaRepository', () => ({
  listarAgendaGestao: vi.fn(async () => ({ appointments: [], temMais: false })),
  profissionalDoAgendamentoGestao: vi.fn(async () => 'pro-from-appointment'),
  convenioDoAgendamentoGestao: vi.fn(async () => ({ pacienteId: 'patient-from-appointment', convenioId: 'conv-1', pacoteSessoes: undefined as number | undefined })),
}));
import { getGestaoAgenda, editGestaoAppointment, updateGestaoChargeDue, updateGestaoMonthlyCoverage } from './gestaoAgendaService';
import { editAgendaAppointment, updateAgendaAppointmentChargeDue } from './agendaService';
import { updatePatientConvenio } from './convenioService';
import { listarAgendaGestao, profissionalDoAgendamentoGestao, convenioDoAgendamentoGestao } from '@/server/scheduling/gestaoAgendaRepository';
const context: RequestContext = {
  actor: { actorType: 'staff', organizationId: 'org-1', userId: 'admin-1', membershipId: 'member-1',
    membershipStatus: 'active', roles: ['admin'] }, correlationId: 'test',
};
beforeEach(() => vi.clearAllMocks());
it.each(['professional', 'billing'] as const)('nega leitura e edição ao perfil %s', async (role) => {
  const denied = { ...context, actor: { ...context.actor, roles: [role] } };
  await expect(getGestaoAgenda(denied)).rejects.toMatchObject({ status: 403 });
  await expect(editGestaoAppointment(denied, 'apt', {})).rejects.toMatchObject({ status: 403 });
  await expect(updateGestaoChargeDue(denied, 'apt', '2099-01-01T12:00:00Z')).rejects.toMatchObject({ status: 403 });
  await expect(updateGestaoMonthlyCoverage(denied, 'apt', 4)).rejects.toMatchObject({ status: 403 });
  expect(listarAgendaGestao).not.toHaveBeenCalled();
  expect(profissionalDoAgendamentoGestao).not.toHaveBeenCalled();
  expect(editAgendaAppointment).not.toHaveBeenCalled();
  expect(updateAgendaAppointmentChargeDue).not.toHaveBeenCalled();
  expect(updatePatientConvenio).not.toHaveBeenCalled();
});

it('permite alterar vencimento sem perfil clínico usando o profissional da sessão', async () => {
  await expect(updateGestaoChargeDue(context, 'apt', '2099-01-01T12:00:00Z')).resolves.toEqual({ updated: true });
  expect(updateAgendaAppointmentChargeDue).toHaveBeenCalledWith({ ...context,
    actor: { ...context.actor, professionalProfileId: 'pro-from-appointment' } }, 'apt', '2099-01-01T12:00:00Z');
});

it('recusa vencimento de sessão fora da organização', async () => {
  vi.mocked(profissionalDoAgendamentoGestao).mockResolvedValueOnce(null);
  await expect(updateGestaoChargeDue(context, 'other-org', '2099-01-01T12:00:00Z')).rejects.toMatchObject({ status: 404 });
  expect(updateAgendaAppointmentChargeDue).not.toHaveBeenCalled();
});

it('aplica limite mensal ao paciente e convênio obtidos da sessão', async () => {
  await updateGestaoMonthlyCoverage(context, 'apt', 4);
  expect(convenioDoAgendamentoGestao).toHaveBeenCalledWith('org-1', 'apt');
  expect(updatePatientConvenio).toHaveBeenCalledWith(context, 'patient-from-appointment', {
    convenioId: 'conv-1', custeadoPelaEmpresa: true, custeioCota: 4, custeioCiclo: 'mensal',
  });
});

it('recusa limite mensal para sessão fora da organização', async () => {
  vi.mocked(convenioDoAgendamentoGestao).mockResolvedValueOnce(null);
  await expect(updateGestaoMonthlyCoverage(context, 'other-org', 4)).rejects.toMatchObject({ status: 404 });
  expect(updatePatientConvenio).not.toHaveBeenCalled();
});

it('exige vínculo com convênio antes de configurar limite mensal', async () => {
  vi.mocked(convenioDoAgendamentoGestao).mockResolvedValueOnce({ pacienteId: 'patient', convenioId: undefined, pacoteSessoes: undefined });
  await expect(updateGestaoMonthlyCoverage(context, 'apt', 4)).rejects.toMatchObject({ status: 400 });
  expect(updatePatientConvenio).not.toHaveBeenCalled();
});

it.each([0, -1, 1.5, NaN, 65536])('recusa limite mensal inválido %s antes de gravar', async (cota) => {
  await expect(updateGestaoMonthlyCoverage(context, 'apt', cota)).rejects.toMatchObject({ status: 400 });
  expect(updatePatientConvenio).not.toHaveBeenCalled();
});

it('não grava uma cota individual que seria ignorada pelo pacote do convênio', async () => {
  vi.mocked(convenioDoAgendamentoGestao).mockResolvedValueOnce({ pacienteId: 'patient', convenioId: 'conv', pacoteSessoes: 8 });
  await expect(updateGestaoMonthlyCoverage(context, 'apt', 4)).rejects.toMatchObject({ status: 409 });
  expect(updatePatientConvenio).not.toHaveBeenCalled();
});
it.each(['admin', 'owner'] as const)('permite %s sem perfil profissional editar o agendamento da organização', async (role) => {
  const authorized = { ...context, actor: { ...context.actor, roles: [role] } };
  await expect(editGestaoAppointment(authorized, 'apt', { custeadoPelaEmpresa: true }))
    .resolves.toEqual({ updated: true });
  expect(profissionalDoAgendamentoGestao).toHaveBeenCalledWith('org-1', 'apt');
  expect(editAgendaAppointment).toHaveBeenCalledWith({ ...authorized,
    actor: { ...authorized.actor, professionalProfileId: 'pro-from-appointment' } },
  'apt', { custeadoPelaEmpresa: true }, { somenteAgendadas: true, permitirHorarioPassado: true });
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
