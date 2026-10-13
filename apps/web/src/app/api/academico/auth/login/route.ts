import { ApplicationError, failure, readJson, success } from '@/server/application/http';
import { authenticateStudent, startStudentSession } from '@/server/academic/studentAuth';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(request: Request) {
  try {
    const body = await readJson(request);
    const session = await authenticateStudent(String(body.email ?? ''), String(body.password ?? ''));
    if (!session) throw new ApplicationError('INVALID_CREDENTIALS', 'E-mail ou senha inválidos.', 401);
    await startStudentSession(session);
    return success({ authenticated: true, destination: session.mustChangePassword ? '/aluno/trocar-senha' : '/aluno' });
  } catch (error) { return failure(error); }
}
