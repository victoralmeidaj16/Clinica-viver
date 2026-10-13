import { readJson, success } from '@/server/application/http';
import { academicApiFailure, booleanValue, numberValue, resolveAcademicManager, stringValue } from '@/server/academic/managementApi';

export const runtime = 'nodejs';

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const [{ id }, body, { service }] = await Promise.all([params, readJson(request), resolveAcademicManager()]);
    return success(await service.createLesson({
      courseId: stringValue(body.courseId), moduleId: id, modulePosition: numberValue(body.modulePosition),
      title: stringValue(body.title), description: stringValue(body.description) || undefined,
      durationMinutes: numberValue(body.durationMinutes), position: numberValue(body.position),
      vimeoUrl: stringValue(body.vimeoUrl), published: booleanValue(body.published),
    }), 201);
  } catch (error) { return academicApiFailure(error); }
}
