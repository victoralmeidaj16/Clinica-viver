import { resolvePatientContext } from '@/server/application/patientContext';
import { failure, readJson, success } from '@/server/application/http';
import { recordPatientMood } from '@/server/application/patientService';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(request: Request) {
  try {
    const context = await resolvePatientContext(request, true);
    const body = await readJson(request);

    const level = Number(body.level);
    if (!Number.isInteger(level) || level < 1 || level > 5) {
      throw new Error('level de humor deve ser um inteiro entre 1 e 5.');
    }

    const emotions = Array.isArray(body.emotions)
      ? body.emotions.map((e) => String(e))
      : [];

    const note = body.note ? String(body.note) : undefined;

    const result = await recordPatientMood(context, {
      level: level as 1 | 2 | 3 | 4 | 5,
      emotions,
      note,
    });

    return success(result, 201);
  } catch (error) {
    return failure(error);
  }
}
