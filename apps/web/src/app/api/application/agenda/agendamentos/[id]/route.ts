import { resolveRequestContext } from '@/server/application/context';
import {
  cancelAgendaAppointment,
  confirmAgendaAppointmentCompleted,
  editAgendaAppointment,
  rescheduleAgendaAppointment,
  updateAgendaAppointmentChargeDue,
} from '@/server/application/agendaService';
import { failure, readJson, success } from '@/server/application/http';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/** Cancelamento, reagendamento, edição ou confirmação de realização na agenda do profissional logado. */
export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const context = await resolveRequestContext(request);
    const { id } = await params;
    const body = await readJson(request);
    if (body.action === 'complete') {
      return success(await confirmAgendaAppointmentCompleted(context, id));
    }
    if (body.action === 'update_charge_due') {
      return success(await updateAgendaAppointmentChargeDue(context, id, String(body.dueAt ?? '')));
    }
    if (body.action === 'reschedule') {
      return success(await rescheduleAgendaAppointment(context, id, String(body.startsAt ?? ''), String(body.endsAt ?? '')));
    }
    if (body.action === 'edit') {
      return success(
        await editAgendaAppointment(context, id, {
          startsAt: body.startsAt ? String(body.startsAt) : undefined,
          endsAt: body.endsAt ? String(body.endsAt) : undefined,
          modalidade: body.modalidade as any,
          status: body.status as any,
        })
      );
    }
    return success(await cancelAgendaAppointment(context, id, String(body.motivo ?? '')));
  } catch (error) {
    return failure(error);
  }
}
