import { resolvePatientContext } from '@/server/application/patientContext';
import { failure, success } from '@/server/application/http';
import { getPatientPortal } from '@/server/application/patientService';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  try {
    const context = await resolvePatientContext(request);
    const portalData = await getPatientPortal(context);
    return success(portalData);
  } catch (error) {
    return failure(error);
  }
}
