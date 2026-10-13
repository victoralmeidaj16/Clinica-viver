import { readJson, success } from '@/server/application/http';
import { academicApiFailure, resolveAcademicManager, stringValue } from '@/server/academic/managementApi';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  try {
    const { service } = await resolveAcademicManager();
    const studentId = new URL(request.url).searchParams.get('studentId') ?? undefined;
    return success(await service.listEnrollments(studentId));
  } catch (error) { return academicApiFailure(error); }
}

export async function POST(request: Request) {
  try {
    const [{ service }, body] = await Promise.all([resolveAcademicManager(), readJson(request)]);
    return success(await service.upsertEnrollment({
      studentId: stringValue(body.studentId), courseId: stringValue(body.courseId),
      status: body.status === 'suspended' ? 'suspended' : 'active',
    }), 201);
  } catch (error) { return academicApiFailure(error); }
}
