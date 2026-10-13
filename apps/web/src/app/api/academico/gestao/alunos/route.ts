import { readJson, success } from '@/server/application/http';
import { academicApiFailure, resolveAcademicManager, stringValue } from '@/server/academic/managementApi';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET() {
  try { const { service } = await resolveAcademicManager(); return success(await service.listStudents()); }
  catch (error) { return academicApiFailure(error); }
}

export async function POST(request: Request) {
  try {
    const { service, actorUserId } = await resolveAcademicManager();
    const body = await readJson(request);
    return success(await service.createStudent({
      fullName: stringValue(body.fullName), email: stringValue(body.email), phone: stringValue(body.phone) || undefined,
      temporaryPassword: stringValue(body.temporaryPassword),
    }, actorUserId), 201);
  } catch (error) { return academicApiFailure(error); }
}
