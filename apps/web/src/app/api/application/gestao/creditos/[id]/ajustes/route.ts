import { resolveRequestContext } from '@/server/application/context';
import { registrarDecisaoCredito } from '@/server/application/creditAdjustmentService';
import { failure, readJson, success } from '@/server/application/http';

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const context = await resolveRequestContext(request, true);
    return success(await registrarDecisaoCredito(context, (await params).id, await readJson(request)));
  } catch (error) { return failure(error); }
}
