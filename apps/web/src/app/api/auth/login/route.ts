import { authenticate, startSession } from '@/server/auth';
import { ApplicationError, failure, readJson, success } from '@/server/application/http';
import { getApplicationStore } from '@/server/application/store';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(request: Request) {
  try {
    const body = await readJson(request);
    const email = String(body.email ?? '');
    const password = String(body.password ?? '');
    const user = await authenticate(email, password);
    if (!user) throw new ApplicationError('INVALID_CREDENTIALS', 'E-mail ou senha inválidos.', 401);
    const membership = await getApplicationStore().identities.findMembershipByUser(user.organizationId, user.userId);
    if (!membership || membership.status !== 'active') throw new ApplicationError('FORBIDDEN', 'Usuário sem vínculo ativo na clínica.', 403);
    const role = membership.roles.some((item) => item === 'owner' || item === 'admin') ? 'admin' : 'psicologo';
    await startSession({ ...user, role });
    return success({ authenticated: true });
  } catch (error) {
    return failure(error);
  }
}
