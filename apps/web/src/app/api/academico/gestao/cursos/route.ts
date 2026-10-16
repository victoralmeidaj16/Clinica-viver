import { readJson, success } from '@/server/application/http';
import { academicApiFailure, booleanValue, numberValue, resolveAcademicManager, stringValue } from '@/server/academic/managementApi';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET() {
  try { const { service } = await resolveAcademicManager(); return success(await service.listCourses()); }
  catch (error) { return academicApiFailure(error); }
}

export async function POST(request: Request) {
  try {
    const [{ service }, body] = await Promise.all([resolveAcademicManager(), readJson(request)]);
    return success(await service.createCourse({
      title: stringValue(body.title), description: stringValue(body.description), coverUrl: stringValue(body.coverUrl) || undefined,
      position: numberValue(body.position), active: body.active !== false, published: booleanValue(body.published),
      certificateTextModel: stringValue(body.certificateTextModel) === 'online-course-with-instructor' ? 'online-course-with-instructor' : 'standard',
      certificateInstructor: stringValue(body.certificateInstructor) || undefined,
      certificateDurationMinutes: numberValue(body.certificateDurationMinutes),
    }), 201);
  } catch (error) { return academicApiFailure(error); }
}
