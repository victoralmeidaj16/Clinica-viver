import { resolveRequestContext } from '@/server/application/context';
import { failure, readJson, success, ApplicationError } from '@/server/application/http';
import { decideRescheduleRequest } from '@/server/application/rescheduleRequestService';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const context = await resolveRequestContext(request);
    const body = await readJson(request);
    if (body.decision !== 'accept' && body.decision !== 'reject') {
      throw new ApplicationError('INVALID_INPUT', 'Informe se deseja aceitar ou recusar a solicitação.', 400);
    }
    const { id } = await params;
    return success(await decideRescheduleRequest(context, id, body.decision));
  } catch (error) { return failure(error); }
}
