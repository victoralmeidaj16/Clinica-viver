import { beforeEach, expect, it, vi } from 'vitest';
import { createStaffAccessContext, InMemoryAppointmentRepository, InMemoryIdentityRepository } from '@thats-life/core';
import type { RequestContext } from './context';
vi.mock('server-only', () => ({}));
const mocks = vi.hoisted(() => ({ store: vi.fn(), guarantee: vi.fn(), contacts: vi.fn(), notify: vi.fn(), mysql: false }));
vi.mock('./store', () => ({ getApplicationStore: mocks.store, persistApplicationState: async () => {} }));
vi.mock('@/server/scheduling/agendaRepository', () => ({ getProfessionalAgendaProfile: async () => ({ servicosHabilitados: ['PSICOTERAPIA'] }), getContatosDaSessao: mocks.contacts }));
vi.mock('@/server/scheduling/agendaAvisos', () => ({ avisarPacienteSessaoMarcada: mocks.notify }));
vi.mock('@/server/oci/runtime', () => ({ isMysqlConfigured: () => mocks.mysql }));
vi.mock('@/server/payments/sessionCharge', () => ({ garantirCobrancaDaSessao: mocks.guarantee }));
import { createAppointmentFlow } from './appointmentService';
const now = '2026-10-27T12:00:00Z';
const context: RequestContext = { actor: createStaffAccessContext({ id: 'member-test', userId: 'user-test', organizationId: 'org-test',
  roles: ['professional'], status: 'active', professionalProfileId: 'pro-test', createdAt: now, updatedAt: now }),
  correlationId: 'test', idempotencyKey: 'command-test' };
const input = { id: 'appointment-test', organizationId: 'org-test', patientId: 'patient-test', professionalId: 'pro-test',
  startsAt: '2099-01-10T14:00:00Z', endsAt: '2099-01-10T14:50:00Z', timezone: 'America/Sao_Paulo', mode: 'video' as const, reminders: [], createdAt: now };
const dueAt = '2099-01-09T15:00:00Z';
let appointments: InMemoryAppointmentRepository;
beforeEach(() => {
  vi.clearAllMocks();
  mocks.mysql = false;
  appointments = new InMemoryAppointmentRepository();
  const identities = new InMemoryIdentityRepository({ professionals: [{ id: 'pro-test', organizationId: 'org-test',
    userId: 'user-test', displayName: 'Profissional fictício', councilType: 'CRP', councilRegistration: '00/00000',
    status: 'active', createdAt: now, updatedAt: now, specialties: [] }], patients: [{ id: 'patient-test', organizationId: 'org-test',
    displayName: 'Paciente fictício', primaryProfessionalId: 'pro-test', assignedProfessionalIds: ['pro-test'], status: 'active', createdAt: now, updatedAt: now }] });
  mocks.store.mockReturnValue({ appointments, identities, preferences: [] });
});
it('confirma ao paciente o agendamento manual mesmo sem preferências de lembrete', async () => {
  mocks.mysql = true;
  const contacts = { agendamentoId: 'physical-id', pacienteTelefone: '11999999999' };
  mocks.contacts.mockResolvedValue(contacts);
  mocks.guarantee.mockResolvedValue('created');
  await createAppointmentFlow(context, input, dueAt, 'PSICOTERAPIA');
  expect(mocks.contacts).toHaveBeenCalledWith(expect.any(String));
  expect(mocks.notify).toHaveBeenCalledWith(contacts);
  expect(await appointments.list({ organizationId: 'org-test' })).toHaveLength(1);
});

it('falha no aviso não transforma um agendamento salvo em erro', async () => {
  mocks.mysql = true;
  mocks.contacts.mockRejectedValueOnce(new Error('Contatos indisponíveis'));
  mocks.guarantee.mockResolvedValue('created');
  await expect(createAppointmentFlow(context, input, dueAt, 'PSICOTERAPIA')).resolves.toMatchObject({
    appointment: { id: input.id }, charge: { status: 'created' },
  });
});
it('retorna falha parcial da cobrança e preserva o vencimento no agendamento', async () => {
  mocks.guarantee.mockResolvedValue('failed');
  const result = await createAppointmentFlow(context, input, dueAt, 'PSICOTERAPIA');
  expect(result).toMatchObject({ charge: { status: 'failed', dueAt } });
  expect(await appointments.getById('org-test', input.id)).toMatchObject({ chargeDueAt: dueAt });
});
it('retenta a cobrança sem duplicar a sessão nem substituir o vencimento original', async () => {
  mocks.guarantee.mockResolvedValueOnce('failed').mockResolvedValueOnce('created');
  await createAppointmentFlow(context, input, dueAt, 'PSICOTERAPIA');
  const replay = await createAppointmentFlow(context, input, '2099-01-08T15:00:00Z', 'PSICOTERAPIA');
  expect(replay).toMatchObject({ idempotentReplay: true, charge: { status: 'created', dueAt } });
  expect(await appointments.list({ organizationId: 'org-test' })).toHaveLength(1);
  expect(mocks.guarantee).toHaveBeenLastCalledWith(input.id, dueAt);
});
