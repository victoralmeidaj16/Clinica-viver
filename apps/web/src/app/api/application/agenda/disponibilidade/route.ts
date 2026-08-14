import { resolveRequestContext } from '@/server/application/context';
import { parseAvailability, saveAvailability } from '@/server/application/agendaService';
import { failure, readJson, success } from '@/server/application/http';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function PUT(request: Request) {
  try {
    const context = await resolveRequestContext(request);
    const body = await readJson(request);
    return success(await saveAvailability(context, parseAvailability(body)));
  } catch (error) {
    return failure(error);
  }
}
