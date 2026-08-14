import { resolveRequestContext } from '@/server/application/context';
import { addBlock } from '@/server/application/agendaService';
import { failure, readJson, success } from '@/server/application/http';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(request: Request) {
  try {
    const context = await resolveRequestContext(request);
    return success(await addBlock(context, await readJson(request)), 201);
  } catch (error) {
    return failure(error);
  }
}
