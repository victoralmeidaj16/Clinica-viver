import type { PreSessionAssessmentSnapshot } from '@thats-life/core';
import { resolvePatientContext } from '@/server/application/patientContext';
import { failure, readJson, success } from '@/server/application/http';
import { submitPatientPreSessionCheckIn } from '@/server/application/patientService';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(request: Request) {
  try {
    const context = await resolvePatientContext(request, true);
    const body = await readJson(request);

    const appointmentId = body.appointmentId ? String(body.appointmentId) : undefined;
    const topicsToDiscuss = body.topicsToDiscuss ? String(body.topicsToDiscuss) : undefined;
    const moodLevel = body.moodLevel ? (Number(body.moodLevel) as 1 | 2 | 3 | 4 | 5) : undefined;
    const assessment = (body.assessment && typeof body.assessment === 'object')
      ? (body.assessment as PreSessionAssessmentSnapshot)
      : undefined;

    const result = await submitPatientPreSessionCheckIn(context, {
      appointmentId,
      topicsToDiscuss,
      moodLevel,
      assessment,
    });

    return success(result, 201);
  } catch (error) {
    return failure(error);
  }
}
