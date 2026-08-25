import { resolveRequestContext } from '@/server/application/context';
import { failure, readJson, success } from '@/server/application/http';
import { cancelarNfse } from '@/server/application/nfseEmissionService';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(request: Request, { params }: { params: Promise<{ faturaId: string }> }) {
  try {
    const { faturaId } = await params;
    const body = await readJson(request);
    return success(await cancelarNfse(await resolveRequestContext(request, true), decodeURIComponent(faturaId), {
      confirmar: body.confirmar, motivo: body.motivo, codigoMotivo: body.codigoMotivo,
    }));
  } catch (error) { return failure(error); }
}
