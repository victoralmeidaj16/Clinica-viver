import { resolveRequestContext } from '@/server/application/context';
import { failure, success } from '@/server/application/http';
import { listSessionsForReview } from '@/server/application/postSessionService';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  try { const context = await resolveRequestContext(request); return success(await listSessionsForReview(context)); }
  catch (error) { return failure(error); }
}
