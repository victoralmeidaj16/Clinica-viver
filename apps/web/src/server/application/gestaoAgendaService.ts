import 'server-only';
import type { RequestContext } from './context';
import { ApplicationError } from './http';
import { editAgendaAppointment } from './agendaService';
import { listarAgendaGestao, profissionalDoAgendamentoGestao } from '@/server/scheduling/gestaoAgendaRepository';
import type { UpdateAppointmentInput } from '@/server/scheduling/agendaRepository';

function exigirAdmin(context: RequestContext) {
  if (!context.actor.roles.some((role) => role === 'admin' || role === 'owner')) {
    throw new ApplicationError('FORBIDDEN', 'A agenda da clínica é exclusiva da administração.', 403);
  }
}

export async function getGestaoAgenda(context: RequestContext, busca = '', pagina = 0) {
  exigirAdmin(context);
  if (!Number.isSafeInteger(pagina) || pagina < 0 || pagina > 100000) {
    throw new ApplicationError('INVALID_INPUT', 'Página inválida.', 400);
  }
  return listarAgendaGestao(context.actor.organizationId, busca.trim().slice(0, 150), pagina);
}

export async function editGestaoAppointment(context: RequestContext, id: string, input: UpdateAppointmentInput) {
  exigirAdmin(context);
  if (input.startsAt !== undefined || input.endsAt !== undefined) {
    const start = Date.parse(input.startsAt ?? '');
    const end = Date.parse(input.endsAt ?? '');
    if (!Number.isFinite(start) || !Number.isFinite(end) || end <= start) {
      throw new ApplicationError('INVALID_INPUT', 'Informe início e término válidos para o atendimento.', 400);
    }
  }
  const professionalId = await profissionalDoAgendamentoGestao(context.actor.organizationId, id);
  if (!professionalId) throw new ApplicationError('NOT_FOUND', 'Agendamento não encontrado.', 404);
  // O profissional vem do agendamento da organização autenticada, nunca do cliente.
  await editAgendaAppointment({ ...context, actor: { ...context.actor, professionalProfileId: professionalId } },
    id, input, { somenteAgendadas: true });
  return { updated: true };
}
