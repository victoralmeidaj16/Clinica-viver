import { resolveRequestContext } from '@/server/application/context';
import { cancelConvenioInvoice } from '@/server/application/convenioService';
import { failure, success } from '@/server/application/http';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function DELETE(request: Request, { params }: { params: Promise<{ id: string; faturaId: string }> }) {
  try {
    const { id, faturaId } = await params;
    return success(await cancelConvenioInvoice(await resolveRequestContext(request, true), decodeURIComponent(id), decodeURIComponent(faturaId)));
  } catch (error) { return failure(error); }
}
