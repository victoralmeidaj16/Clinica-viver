import { resolveRequestContext } from '@/server/application/context';
import { failure, readJson, success } from '@/server/application/http';
import { registerManualPayment } from '@/server/application/manualPaymentService';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(request: Request, { params }: { params: Promise<{ chargeId: string }> }) {
  try {
    const context = await resolveRequestContext(request, true);
    const { chargeId } = await params;
    return success(await registerManualPayment(context, chargeId, await readJson(request)));
  } catch (error) {
    return failure(error);
  }
}
