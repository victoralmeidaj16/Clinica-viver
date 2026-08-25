import { resolveRequestContext } from '@/server/application/context';
import { createConvenioBoleto } from '@/server/application/convenioService';
import { failure, success } from '@/server/application/http';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(request: Request, { params }: { params: Promise<{ id: string; faturaId: string }> }) {
  try {
    const { id, faturaId } = await params;
    return success(await createConvenioBoleto(await resolveRequestContext(request, true), decodeURIComponent(id), decodeURIComponent(faturaId)));
  } catch (error) { return failure(error); }
}
