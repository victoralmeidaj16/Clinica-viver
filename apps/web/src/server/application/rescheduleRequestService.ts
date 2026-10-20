import 'server-only';

import type { RequestContext } from './context';
import { ApplicationError } from './http';
import { decidePatientRescheduleRequest } from '@/server/scheduling/rescheduleRequestRepository';
import { getContatosDaSessao, listAppointments } from '@/server/scheduling/agendaRepository';
import { concluirReagendamento } from '@/server/scheduling/agendaReagendamentoEffects';
import { avisarRecusaReagendamentoPaciente } from '@/server/scheduling/agendaAvisos';

export async function decideRescheduleRequest(
  context: RequestContext,
  requestId: string,
  decision: 'accept' | 'reject'
) {
  const professionalId = context.actor.professionalProfileId;
  if (!professionalId) throw new ApplicationError('FORBIDDEN', 'Apenas o psicólogo responsável pode responder.', 403);
  const result = await decidePatientRescheduleRequest(
    context.actor.organizationId,
    professionalId,
    requestId,
    decision
  );
  if (!result.ok) {
    if (result.reason === 'NOT_FOUND') throw new ApplicationError('NOT_FOUND', 'Solicitação não encontrada.', 404);
    if (result.reason === 'UNAVAILABLE') throw new ApplicationError('SLOT_UNAVAILABLE', 'O horário solicitado não está mais disponível. Recuse a solicitação e combine outro horário com o paciente.', 409);
    if (result.reason === 'APPOINTMENT_CHANGED') throw new ApplicationError('APPOINTMENT_CHANGED', 'A sessão foi alterada ou cancelada depois da solicitação. Revise a agenda antes de responder.', 409);
    throw new ApplicationError('REQUEST_ALREADY_DECIDED', 'Esta solicitação já foi respondida.', 409);
  }
  if (result.decision === 'accepted') {
    await concluirReagendamento({ id: result.appointmentId, inicioAnterior: result.previousStartsAt,
      inicio: result.startsAt, fim: result.endsAt, versao: result.version });
  } else {
    try {
      const contacts = await getContatosDaSessao(result.appointmentId);
      if (contacts) await avisarRecusaReagendamentoPaciente(contacts, result.requestSequence);
    } catch (noticeError) {
      console.error('[agenda] Recusa gravada, mas o aviso ao paciente falhou:', noticeError);
    }
  }
  const desde = new Date(Date.now() - 90 * 24 * 60 * 60_000);
  return { appointments: await listAppointments(context.actor.organizationId, professionalId, desde) };
}
