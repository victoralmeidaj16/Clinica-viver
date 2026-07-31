import { changeAppointment } from '@/server/application/appointmentService';
import { resolveRequestContext } from '@/server/application/context';
import { failure, readJson, success } from '@/server/application/http';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try { const context = await resolveRequestContext(request, true); const { id } = await params; return success(await changeAppointment(context, id, await readJson(request))); }
  catch (error) { return failure(error); }
}
