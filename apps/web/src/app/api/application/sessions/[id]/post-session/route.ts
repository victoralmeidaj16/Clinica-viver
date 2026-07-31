import { resolveRequestContext } from '@/server/application/context';
import { failure, readJson, success } from '@/server/application/http';
import { parsePostSessionInput } from '@/server/application/postSessionInput';
import { runPostSessionAutomation } from '@/server/application/postSessionService';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const context = await resolveRequestContext(request, true);
    const { id } = await params;
    const input = parsePostSessionInput(await readJson(request));
    return success(await runPostSessionAutomation(context, id, input), 201);
  } catch (error) { return failure(error); }
}
