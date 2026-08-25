import { resolveRequestContext } from '@/server/application/context';
import { emitirNfseFatura, previaNfseFatura } from '@/server/application/convenioNfseService';
import { consultarEmissaoNfse } from '@/server/application/nfseEmissionService';
import { failure, readJson, success } from '@/server/application/http';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(request: Request, { params }: { params: Promise<{ id: string; faturaId: string }> }) {
  try {
    const context = await resolveRequestContext(request);
    const { id, faturaId } = await params;
    const invoiceId = decodeURIComponent(faturaId);
    const [preview, emission] = await Promise.all([
      previaNfseFatura(context, decodeURIComponent(id), invoiceId),
      consultarEmissaoNfse(context, invoiceId),
    ]);
    return success({ preview, emission });
  } catch (error) { return failure(error); }
}

export async function POST(request: Request, { params }: { params: Promise<{ id: string; faturaId: string }> }) {
  try {
    const context = await resolveRequestContext(request, true);
    const { id, faturaId } = await params;
    const body = await readJson(request);
    return success(await emitirNfseFatura(context, decodeURIComponent(id), decodeURIComponent(faturaId), body.confirmar));
  } catch (error) { return failure(error); }
}
