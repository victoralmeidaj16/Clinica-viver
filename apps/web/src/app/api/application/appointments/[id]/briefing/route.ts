import { resolveRequestContext } from '@/server/application/context';
import { failure, success } from '@/server/application/http';
import { getPreSessionBriefing } from '@/server/application/preSessionService';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const context = await resolveRequestContext(request);
    const { id } = await params;
    const result = await getPreSessionBriefing(context, id);
    return success(result);
  } catch (error) {
    return failure(error);
  }
}
