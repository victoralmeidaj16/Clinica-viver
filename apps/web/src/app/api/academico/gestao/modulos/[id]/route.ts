import { readJson, success } from '@/server/application/http';
import { academicApiFailure, numberValue, resolveAcademicManager, stringValue } from '@/server/academic/managementApi';

export const runtime = 'nodejs';

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const [{ id }, body, { service }] = await Promise.all([params, readJson(request), resolveAcademicManager()]);
    return success(await service.updateModule(id, {
      courseId: stringValue(body.courseId), title: stringValue(body.title), position: numberValue(body.position),
    }));
  } catch (error) { return academicApiFailure(error); }
}
