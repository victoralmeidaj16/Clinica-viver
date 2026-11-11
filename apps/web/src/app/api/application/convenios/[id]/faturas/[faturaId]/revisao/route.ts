import { resolveRequestContext } from '@/server/application/context';
import { resolveConvenioInvoiceReview } from '@/server/application/convenioService';
import { failure, readJson, success } from '@/server/application/http';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(request: Request, { params }: { params: Promise<{ id: string; faturaId: string }> }) {
  try {
    const context = await resolveRequestContext(request, true);
    const { id, faturaId } = await params;
    return success(await resolveConvenioInvoiceReview(context, decodeURIComponent(id), decodeURIComponent(faturaId), await readJson(request)));
  } catch (error) { return failure(error); }
}
