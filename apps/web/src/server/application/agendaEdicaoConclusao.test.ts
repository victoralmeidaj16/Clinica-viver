import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('server-only', () => ({}));
vi.mock('@/server/scheduling/agendaAvisos', () => ({ avisarSessaoCancelada: vi.fn() }));
vi.mock('@/server/payments/sessionCharge', () => ({
  atualizarVencimentoCobrancaSessao: vi.fn(),
  cancelarCobrancaDaSessao: vi.fn(),
}));
vi.mock('@/server/scheduling/agendaRepository', () => ({
  cancelAppointment: vi.fn(),
  completeAppointment: vi.fn(async () => 'completed'),
  createBlock: vi.fn(),
  deleteBlock: vi.fn(),
  getContatosDaSessao: vi.fn(),
  getProfessionalAgendaProfile: vi.fn(),
  listAppointments: vi.fn(async () => []),
  listAvailability: vi.fn(),
  listBlocks: vi.fn(),
  replaceAvailability: vi.fn(),
  rescheduleAppointmentProfessional: vi.fn(),
  updateAppointmentDetails: vi.fn(async () => 'ok'),
}));

import { editAgendaAppointment } from './agendaService';
import {
  completeAppointment,
  updateAppointmentDetails,
} from '@/server/scheduling/agendaRepository';
import type { RequestContext } from './context';

const context = {
  actor: { organizationId: 'org-1', professionalProfileId: 'pro-1' },
} as RequestContext;

/**
 * A edição ajusta horário e modalidade; a realização é um fato clínico que
 * passa por `completeAppointment`, onde a sessão e a cobrança nascem.
 */
describe('editAgendaAppointment', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(updateAppointmentDetails).mockResolvedValue('ok');
    vi.mocked(completeAppointment).mockResolvedValue('completed');
  });

  it('delega a realização ao fluxo de conclusão em vez de gravar o status', async () => {
    await editAgendaAppointment(context, 'apt-1', {
      startsAt: '2026-09-01T12:00:00.000Z',
      status: 'realizado',
    });

    expect(updateAppointmentDetails).toHaveBeenCalledWith(
      'org-1',
      'pro-1',
      'apt-1',
      { startsAt: '2026-09-01T12:00:00.000Z', status: undefined },
      // A edição avisa que vai concluir, para a validação do término acontecer
      // dentro da mesma transação que grava o horário.
      { concluirDepois: true }
    );
    expect(completeAppointment).toHaveBeenCalledWith('org-1', 'pro-1', 'apt-1');
  });

  it('recusa concluir uma sessão que ainda não terminou', async () => {
    vi.mocked(completeAppointment).mockResolvedValueOnce('too_early');

    await expect(
      editAgendaAppointment(context, 'apt-1', { status: 'realizado' })
    ).rejects.toMatchObject({ code: 'APPOINTMENT_NOT_FINISHED', status: 409 });
  });

  it('aceita o reenvio do status atual de um atendimento já concluído', async () => {
    vi.mocked(completeAppointment).mockResolvedValueOnce('already_completed');

    await expect(
      editAgendaAppointment(context, 'apt-1', { modalidade: 'online', status: 'realizado' })
    ).resolves.toEqual({ appointments: [] });
  });

  it('traduz a trava de reversão em erro de conflito', async () => {
    vi.mocked(updateAppointmentDetails).mockResolvedValueOnce('completed_locked');

    await expect(
      editAgendaAppointment(context, 'apt-1', { status: 'agendado' })
    ).rejects.toMatchObject({ code: 'APPOINTMENT_ALREADY_COMPLETED', status: 409 });
    expect(completeAppointment).not.toHaveBeenCalled();
  });

  it('não aciona a conclusão numa edição só de horário', async () => {
    await editAgendaAppointment(context, 'apt-1', { startsAt: '2026-09-01T12:00:00.000Z' });

    expect(completeAppointment).not.toHaveBeenCalled();
  });
});
