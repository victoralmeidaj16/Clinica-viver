import { resolveRequestContext } from '@/server/application/context';
import {
  cancelAgendaAppointment,
  confirmAgendaAppointmentCompleted,
  updateAgendaAppointmentChargeDue,
} from '@/server/application/agendaService';
import { failure, readJson, success } from '@/server/application/http';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/** Cancelamento ou confirmação de realização, sempre na agenda do profissional logado. */
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
    return success(await cancelAgendaAppointment(context, id, String(body.motivo ?? '')));
  } catch (error) {
    return failure(error);
  }
}
