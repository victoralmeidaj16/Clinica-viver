import { readJson, success } from '@/server/application/http';
import { academicApiFailure, resolveAcademicManager, stringValue } from '@/server/academic/managementApi';

export const runtime = 'nodejs';

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const [{ id }, body, { service, actorUserId }] = await Promise.all([params, readJson(request), resolveAcademicManager()]);
    await service.resetTemporaryPassword(id, stringValue(body.temporaryPassword), actorUserId);
    return success({ reset: true });
  } catch (error) { return academicApiFailure(error); }
}
