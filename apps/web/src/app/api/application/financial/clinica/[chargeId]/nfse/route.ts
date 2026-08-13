import { resolveRequestContext } from '@/server/application/context';
import { failure, readJson, success } from '@/server/application/http';
import { emitirNfse } from '@/server/application/nfseEmissionService';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/** Emite uma DPS assinada somente após a confirmação explícita da gestão. */
export async function POST(
  request: Request,
  { params }: { params: Promise<{ chargeId: string }> }
) {
  try {
    const context = await resolveRequestContext(request, true);
    const { chargeId } = await params;
    const body = await readJson(request);
    return success(await emitirNfse(context, chargeId, body.confirmar));
  } catch (error) {
    return failure(error);
  }
}
