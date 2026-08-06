import { resolveRequestContext } from '@/server/application/context';
import { failure, readJson, success } from '@/server/application/http';
import { createPatient, listPatientDirectory } from '@/server/application/patientDirectory';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  try {
    const context = await resolveRequestContext(request);
    return success(await listPatientDirectory(context));
  } catch (error) {
    return failure(error);
  }
}

export async function POST(request: Request) {
  try {
    const context = await resolveRequestContext(request, true);
    const body = await readJson(request);
    return success(await createPatient(context, body), 201);
  } catch (error) {
    return failure(error);
  }
}
