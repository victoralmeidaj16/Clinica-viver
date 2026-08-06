import { readSession } from '@/server/auth';
import { getApplicationStore } from '@/server/application/store';
import { failure, success } from '@/server/application/http';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const session = await readSession();
    if (!session) return Response.json({ ok: false, error: { code: 'UNAUTHENTICATED', message: 'Sessão ausente.' } }, { status: 401 });
    const membership = await getApplicationStore().identities.findMembershipByUser(session.organizationId, session.userId);
    if (!membership || membership.status !== 'active') return Response.json({ ok: false, error: { code: 'FORBIDDEN', message: 'Vínculo ativo não encontrado.' } }, { status: 403 });
    const user = await getApplicationStore().identities.getUser(session.userId);
    const isAdmin = membership.roles.some((role) => role === 'owner' || role === 'admin');
    return success({
      userId: session.userId,
      organizationId: session.organizationId,
      displayName: user?.displayName ?? session.userId,
      role: isAdmin ? 'admin' : 'psicologo',
      professionalProfileId: membership.professionalProfileId,
    });
  } catch (error) {
    return failure(error);
  }
}
