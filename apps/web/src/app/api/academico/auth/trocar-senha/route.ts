import { readJson, success } from '@/server/application/http';
import { readStudentSession, startStudentSession } from '@/server/academic/studentAuth';
import { resolveStudentPortal, studentApiFailure } from '@/server/academic/studentApi';

export const runtime = 'nodejs';

export async function POST(request: Request) {
  try {
    const [body, session, context] = await Promise.all([
      readJson(request), readStudentSession(), resolveStudentPortal({ allowPasswordChange: true }),
    ]);
    await context.service.changePassword(context.student.id, String(body.password ?? ''));
    if (session) await startStudentSession({ ...session, mustChangePassword: false });
    return success({ changed: true, destination: '/aluno' });
  } catch (error) { return studentApiFailure(error); }
}
