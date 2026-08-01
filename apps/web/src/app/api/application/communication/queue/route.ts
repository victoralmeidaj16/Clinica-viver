import { resolveRequestContext } from '@/server/application/context';
import { failure, success } from '@/server/application/http';
import { getCommunicationQueue } from '@/server/application/communicationService';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  try {
    const context = await resolveRequestContext(request);
    const result = await getCommunicationQueue(context);
    return success(result);
  } catch (error) {
    return failure(error);
  }
}
