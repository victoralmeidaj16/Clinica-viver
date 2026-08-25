import { resolveRequestContext } from '@/server/application/context';
import { createConvenio, listConvenios } from '@/server/application/convenioService';
import { failure, readJson, success } from '@/server/application/http';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  try { return success(await listConvenios(await resolveRequestContext(request))); }
  catch (error) { return failure(error); }
}

export async function POST(request: Request) {
  try { return success(await createConvenio(await resolveRequestContext(request, true), await readJson(request)), 201); }
  catch (error) { return failure(error); }
}
