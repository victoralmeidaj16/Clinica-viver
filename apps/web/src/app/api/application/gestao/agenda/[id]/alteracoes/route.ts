import { resolveRequestContext } from '@/server/application/context';
import { historicoGestaoAppointment } from '@/server/application/gestaoAgendaService';
import { failure, success } from '@/server/application/http';

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const context = await resolveRequestContext(request);
    return success(await historicoGestaoAppointment(context, (await params).id));
  } catch (error) {
    return failure(error);
  }
}
