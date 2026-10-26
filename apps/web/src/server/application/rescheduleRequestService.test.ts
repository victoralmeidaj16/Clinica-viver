import { beforeEach, describe, expect, it, vi } from 'vitest';
vi.mock('server-only', () => ({}));
const state = vi.hoisted(() => ({ decide: vi.fn(), finish: vi.fn(), rejectNotice: vi.fn(), contacts: vi.fn(), list: vi.fn() }));
vi.mock('@/server/scheduling/rescheduleRequestRepository', () => ({ decidePatientRescheduleRequest: state.decide }));
vi.mock('@/server/scheduling/agendaReagendamentoEffects', () => ({ concluirReagendamento: state.finish }));
vi.mock('@/server/scheduling/agendaAvisos', () => ({ avisarRecusaReagendamentoPaciente: state.rejectNotice }));
vi.mock('@/server/scheduling/agendaRepository', () => ({ getContatosDaSessao: state.contacts, listAppointments: state.list }));
import { decideRescheduleRequest } from './rescheduleRequestService';
import type { RequestContext } from './context';

const context = { actor: { organizationId: 'org', professionalProfileId: 'pro' } } as RequestContext;

beforeEach(() => {
  vi.clearAllMocks(); state.list.mockResolvedValue([]); state.finish.mockResolvedValue(undefined);
});

describe('decideRescheduleRequest', () => {
  it('encerra pedido de sessão inativa sem enviar confirmação de horário', async () => {
    state.decide.mockResolvedValue({ ok: true, decision: 'rejected', appointmentId: 'appt',
      startsAt: '2026-10-21T10:00:00Z', requestSequence: 2, notifyPatient: false });
    state.contacts.mockResolvedValue({ agendamentoId: 'appt' });
    await expect(decideRescheduleRequest(context, 'request', 'reject')).resolves.toEqual({ appointments: [] });
    expect(state.rejectNotice).not.toHaveBeenCalled();
    expect(state.finish).not.toHaveBeenCalled();
  });
  it('executa os efeitos de remarcação apenas depois do aceite persistido', async () => {
    state.decide.mockResolvedValue({ ok: true, decision: 'accepted', appointmentId: 'appt',
      previousStartsAt: '2026-10-21T10:00:00Z', startsAt: '2026-10-22T10:00:00Z', endsAt: '2026-10-22T10:50:00Z', version: 3 });
    await decideRescheduleRequest(context, 'request', 'accept');
    expect(state.finish).toHaveBeenCalledWith(expect.objectContaining({ id: 'appt', versao: 3 }));
    expect(state.rejectNotice).not.toHaveBeenCalled();
  });

  it('mantém a decisão gravada mesmo quando o WhatsApp da recusa falha', async () => {
    state.decide.mockResolvedValue({ ok: true, decision: 'rejected', appointmentId: 'appt', startsAt: '2026-10-21T10:00:00Z', requestSequence: 2 });
    state.contacts.mockResolvedValue({ agendamentoId: 'appt' });
    state.rejectNotice.mockRejectedValue(new Error('provedor indisponível'));
    await expect(decideRescheduleRequest(context, 'request', 'reject')).resolves.toEqual({ appointments: [] });
  });

  it('traduz conflito de horário em orientação clara', async () => {
    state.decide.mockResolvedValue({ ok: false, reason: 'UNAVAILABLE' });
    await expect(decideRescheduleRequest(context, 'request', 'accept')).rejects.toMatchObject({
      code: 'SLOT_UNAVAILABLE', status: 409,
    });
    expect(state.finish).not.toHaveBeenCalled();
  });
});
