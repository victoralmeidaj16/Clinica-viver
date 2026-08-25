import { resolveRequestContext } from '@/server/application/context';
import { closeConvenioInvoice } from '@/server/application/convenioService';
import { failure, readJson, success } from '@/server/application/http';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    return success(await closeConvenioInvoice(await resolveRequestContext(request, true), decodeURIComponent(id), await readJson(request)), 201);
  } catch (error) { return failure(error); }
}
