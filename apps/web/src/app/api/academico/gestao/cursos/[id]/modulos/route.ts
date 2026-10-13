import { readJson, success } from '@/server/application/http';
import { academicApiFailure, numberValue, resolveAcademicManager, stringValue } from '@/server/academic/managementApi';

export const runtime = 'nodejs';

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const [{ id }, body, { service }] = await Promise.all([params, readJson(request), resolveAcademicManager()]);
    return success(await service.createModule({ courseId: id, title: stringValue(body.title), position: numberValue(body.position) }), 201);
  } catch (error) { return academicApiFailure(error); }
}
