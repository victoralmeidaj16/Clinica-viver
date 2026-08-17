import { resolveRequestContext } from '@/server/application/context';
import { failure, readJson, success } from '@/server/application/http';
import { cancelarNfse } from '@/server/application/nfseEmissionService';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * Registra o evento de cancelamento da NFS-e.
 *
 * Exige `Idempotency-Key` pelo mesmo motivo da emissão: um clique repetido não
 * pode virar um segundo pedido de evento no ambiente fiscal.
 */
export async function POST(
  request: Request,
  { params }: { params: Promise<{ chargeId: string }> }
) {
  try {
    const context = await resolveRequestContext(request, true);
    const { chargeId } = await params;
    const body = await readJson(request);
    return success(
      await cancelarNfse(context, decodeURIComponent(chargeId), {
        confirmar: body.confirmar,
        motivo: body.motivo,
        codigoMotivo: body.codigoMotivo,
      })
    );
  } catch (error) {
    return failure(error);
  }
}
