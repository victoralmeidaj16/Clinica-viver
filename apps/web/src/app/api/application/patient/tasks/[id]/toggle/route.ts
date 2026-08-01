import { resolvePatientContext } from '@/server/application/patientContext';
import { failure, success } from '@/server/application/http';
import { togglePatientTask } from '@/server/application/patientService';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const context = await resolvePatientContext(request, true);
    const { id: taskId } = await params;
    const result = await togglePatientTask(context, taskId);
    return success(result);
  } catch (error) {
    return failure(error);
  }
}
