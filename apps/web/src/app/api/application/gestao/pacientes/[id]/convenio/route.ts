import { resolveRequestContext } from '@/server/application/context';
import { updatePatientConvenio } from '@/server/application/convenioService';
import { failure, readJson, success } from '@/server/application/http';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function PUT(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    return success(await updatePatientConvenio(await resolveRequestContext(request, true), decodeURIComponent(id), await readJson(request)));
  } catch (error) { return failure(error); }
}
