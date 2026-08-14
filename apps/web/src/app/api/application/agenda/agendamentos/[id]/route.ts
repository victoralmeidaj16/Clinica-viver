import { resolveRequestContext } from '@/server/application/context';
import { cancelAgendaAppointment } from '@/server/application/agendaService';
import { failure, readJson, success } from '@/server/application/http';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/** Cancelamento com motivo. É a única mutação que a aba faz num agendamento. */
export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const context = await resolveRequestContext(request);
    const { id } = await params;
    const body = await readJson(request);
    return success(await cancelAgendaAppointment(context, id, String(body.motivo ?? '')));
  } catch (error) {
    return failure(error);
  }
}
