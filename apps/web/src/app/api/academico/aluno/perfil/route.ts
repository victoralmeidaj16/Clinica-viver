import { readJson, success } from '@/server/application/http';
import { resolveStudentPortal, studentApiFailure } from '@/server/academic/studentApi';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET() {
  try { const { student, service } = await resolveStudentPortal(); return success(await service.getProfile(student.id)); }
  catch (error) { return studentApiFailure(error); }
}

export async function PATCH(request: Request) {
  try {
    const [body, { student, service }] = await Promise.all([readJson(request), resolveStudentPortal()]);
    return success(await service.updateProfile(student.id, {
      fullName: String(body.fullName ?? ''), phone: typeof body.phone === 'string' ? body.phone : undefined,
    }));
  } catch (error) { return studentApiFailure(error); }
}
