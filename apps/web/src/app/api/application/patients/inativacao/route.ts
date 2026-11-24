import { resolveRequestContext } from '@/server/application/context';
import { failure, readJson, success } from '@/server/application/http';
import { inactivateOwnPatient } from '@/server/application/patientInactivation';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/** Psicólogo responsável inativa o vínculo, com motivo obrigatório (6.05). */
export async function POST(request: Request) {
  try {
    const context = await resolveRequestContext(request, true);
    const body = await readJson(request);
    return success(await inactivateOwnPatient(context, body), 201);
  } catch (error) {
    return failure(error);
  }
}
