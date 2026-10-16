import { readJson, success } from '@/server/application/http';
import { academicApiFailure, booleanValue, numberValue, resolveAcademicManager, stringValue } from '@/server/academic/managementApi';

export const runtime = 'nodejs';

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  try { const [{ id }, { service }] = await Promise.all([params, resolveAcademicManager()]); return success(await service.getCourse(id)); }
  catch (error) { return academicApiFailure(error); }
}

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const [{ id }, body, { service }] = await Promise.all([params, readJson(request), resolveAcademicManager()]);
    return success(await service.updateCourse(id, {
      title: stringValue(body.title), description: stringValue(body.description), coverUrl: stringValue(body.coverUrl) || undefined,
      position: numberValue(body.position), active: body.active !== false, published: booleanValue(body.published),
      certificateTextModel: stringValue(body.certificateTextModel) === 'online-course-with-instructor' ? 'online-course-with-instructor' : 'standard',
      certificateInstructor: stringValue(body.certificateInstructor) || undefined,
      certificateDurationMinutes: numberValue(body.certificateDurationMinutes),
    }));
  } catch (error) { return academicApiFailure(error); }
}
