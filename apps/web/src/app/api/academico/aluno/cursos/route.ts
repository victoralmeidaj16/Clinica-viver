import { success } from '@/server/application/http';
import { resolveStudentPortal, studentApiFailure } from '@/server/academic/studentApi';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET() {
  try { const { student, service } = await resolveStudentPortal(); return success(await service.listCourses(student.id)); }
  catch (error) { return studentApiFailure(error); }
}
