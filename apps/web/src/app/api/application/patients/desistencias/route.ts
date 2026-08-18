import { resolveRequestContext } from '@/server/application/context';
import { failure, readJson, success } from '@/server/application/http';
import { registerPatientDropout } from '@/server/application/patientDirectory';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(request: Request) {
  try {
    const context = await resolveRequestContext(request, true);
    const body = await readJson(request);
    return success(await registerPatientDropout(context, body), 201);
  } catch (error) {
    return failure(error);
  }
}
