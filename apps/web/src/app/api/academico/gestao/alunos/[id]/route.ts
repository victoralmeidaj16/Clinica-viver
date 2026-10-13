import { readJson, success } from '@/server/application/http';
import { academicApiFailure, resolveAcademicManager, stringValue } from '@/server/academic/managementApi';

export const runtime = 'nodejs';

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const [{ id }, body, { service }] = await Promise.all([params, readJson(request), resolveAcademicManager()]);
    return success(await service.updateStudent(id, {
      fullName: stringValue(body.fullName), email: stringValue(body.email), phone: stringValue(body.phone) || undefined,
      status: body.status === 'disabled' ? 'disabled' : 'active',
    }));
  } catch (error) { return academicApiFailure(error); }
}
