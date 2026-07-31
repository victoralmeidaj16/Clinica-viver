import { createAppointmentFlow, listAppointments, parseAppointmentInput } from '@/server/application/appointmentService';
import { resolveRequestContext } from '@/server/application/context';
import { failure, readJson, success } from '@/server/application/http';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  try { const context = await resolveRequestContext(request); return success(await listAppointments(context)); }
  catch (error) { return failure(error); }
}

export async function POST(request: Request) {
  try { const context = await resolveRequestContext(request, true); const body = await readJson(request); return success(await createAppointmentFlow(context, parseAppointmentInput(body, context)), 201); }
  catch (error) { return failure(error); }
}
