import { resolvePatientContext } from '@/server/application/patientContext';
import { failure, readJson, success } from '@/server/application/http';
import { submitPatientAssessment } from '@/server/application/patientService';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(request: Request) {
  try {
    const context = await resolvePatientContext(request, true);
    const body = await readJson(request);

    const type = String(body.type || 'PHQ-9 / GAD-7');
    const answers = (body.answers && typeof body.answers === 'object')
      ? (body.answers as Record<string, number>)
      : {};

    const result = await submitPatientAssessment(context, { type, answers });
    return success(result, 201);
  } catch (error) {
    return failure(error);
  }
}
