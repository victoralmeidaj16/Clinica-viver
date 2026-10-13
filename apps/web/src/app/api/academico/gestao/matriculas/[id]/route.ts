import { readJson, success } from '@/server/application/http';
import { academicApiFailure, resolveAcademicManager } from '@/server/academic/managementApi';

export const runtime = 'nodejs';

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const [{ id }, body, { service }] = await Promise.all([params, readJson(request), resolveAcademicManager()]);
    return success(await service.setEnrollmentStatus(id, body.status === 'suspended' ? 'suspended' : 'active'));
  } catch (error) { return academicApiFailure(error); }
}
