import { resolveRequestContext } from '@/server/application/context';
import { getAgendaOverview } from '@/server/application/agendaService';
import { failure, success } from '@/server/application/http';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  try {
    return success(await getAgendaOverview(await resolveRequestContext(request)));
  } catch (error) {
    return failure(error);
  }
}
