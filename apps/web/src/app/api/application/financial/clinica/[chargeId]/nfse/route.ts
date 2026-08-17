import { resolveRequestContext } from '@/server/application/context';
import { failure, readJson, success } from '@/server/application/http';
import { consultarEmissaoNfse, emitirNfse } from '@/server/application/nfseEmissionService';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/** Situação fiscal da cobrança: se a nota existe, falhou ou foi cancelada. */
export async function GET(
  request: Request,
  { params }: { params: Promise<{ chargeId: string }> }
) {
  try {
    const context = await resolveRequestContext(request);
    const { chargeId } = await params;
    return success(await consultarEmissaoNfse(context, decodeURIComponent(chargeId)));
  } catch (error) {
    return failure(error);
  }
}

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
