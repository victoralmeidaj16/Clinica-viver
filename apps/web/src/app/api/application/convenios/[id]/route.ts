import { resolveRequestContext } from '@/server/application/context';
import { getConvenioDetail, updateConvenio } from '@/server/application/convenioService';
import { failure, readJson, success } from '@/server/application/http';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const url = new URL(request.url);
    return success(await getConvenioDetail(await resolveRequestContext(request), decodeURIComponent(id), {
      inicio: url.searchParams.get('inicio') ?? undefined, fim: url.searchParams.get('fim') ?? undefined,
    }));
  } catch (error) { return failure(error); }
}

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    return success(await updateConvenio(await resolveRequestContext(request, true), decodeURIComponent(id), await readJson(request)));
  } catch (error) { return failure(error); }
}
