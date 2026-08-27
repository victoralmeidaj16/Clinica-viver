import { getPatientRegistration, updatePatientRegistration } from '@/server/application/patientDirectory';
import { resolveRequestContext } from '@/server/application/context';
import { failure, readJson, success } from '@/server/application/http';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const context = await resolveRequestContext(request);
    const { id } = await params;
    return success(await getPatientRegistration(context, decodeURIComponent(id)));
  } catch (error) {
    return failure(error);
  }
}

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const context = await resolveRequestContext(request, true);
    const { id } = await params;
    return success(await updatePatientRegistration(context, decodeURIComponent(id), await readJson(request)));
  } catch (error) {
    return failure(error);
  }
}
