import { success } from '@/server/application/http';
import { resolveStudentPortal, studentApiFailure } from '@/server/academic/studentApi';

export const runtime = 'nodejs';

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const [{ id }, { student, service }] = await Promise.all([params, resolveStudentPortal()]);
    return success(await service.getLesson(student.id, id));
  } catch (error) { return studentApiFailure(error); }
}
