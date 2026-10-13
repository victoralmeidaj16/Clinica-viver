import { success } from '@/server/application/http';
import { studentApiFailure, resolveStudentPortal } from '@/server/academic/studentApi';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const { student } = await resolveStudentPortal({ allowPasswordChange: true });
    return success({ student, mustChangePassword: student.mustChangePassword });
  } catch (error) { return studentApiFailure(error); }
}
