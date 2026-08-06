import { resolveRequestContext } from '@/server/application/context';
import { failure, readJson, success } from '@/server/application/http';
import { createProfessional, listProfessionals } from '@/server/application/professionalDirectory';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  try {
    const context = await resolveRequestContext(request);
    return success(await listProfessionals(context));
  } catch (error) {
    return failure(error);
  }
}

export async function POST(request: Request) {
  try {
    const context = await resolveRequestContext(request, true);
    const body = await readJson(request);
    return success(await createProfessional(context, body), 201);
  } catch (error) {
    return failure(error);
  }
}
