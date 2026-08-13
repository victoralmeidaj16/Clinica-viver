import { resolveRequestContext } from '@/server/application/context';
import { getNfsePreview } from '@/server/application/clinicFinanceService';
import { failure, success } from '@/server/application/http';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/** Prévia fiscal exclusiva para a gestão, antes de uma emissão real. */
export async function GET(
  request: Request,
  { params }: { params: Promise<{ chargeId: string }> }
) {
  try {
    const context = await resolveRequestContext(request);
    const { chargeId } = await params;
    return success(await getNfsePreview(context, chargeId));
  } catch (error) {
    return failure(error);
  }
}
