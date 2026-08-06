import { createStaffAccessContext, type StaffAccessContext } from '@thats-life/core';
import { readSession } from '@/server/auth';
import { ApplicationError } from './http';
import { getApplicationStore } from './store';

export interface RequestContext { actor: StaffAccessContext; idempotencyKey?: string; correlationId: string; }

export async function resolveRequestContext(request: Request, requireIdempotency = false): Promise<RequestContext> {
  const session = await readSession();
  if (!session) throw new ApplicationError('UNAUTHENTICATED', 'Faça login para continuar.', 401);
  const organizationId = session.organizationId;
  const userId = session.userId;
  const membership = await getApplicationStore().identities.findMembershipByUser(organizationId, userId);
  if (!membership || membership.status !== 'active') throw new ApplicationError('FORBIDDEN', 'Vínculo organizacional ativo não encontrado.', 403);
  const idempotencyKey = request.headers.get('idempotency-key') ?? undefined;
  if (requireIdempotency && !idempotencyKey) throw new ApplicationError('IDEMPOTENCY_REQUIRED', 'O cabeçalho Idempotency-Key é obrigatório.', 400);
  return { actor: createStaffAccessContext(membership), idempotencyKey, correlationId: request.headers.get('x-correlation-id') ?? crypto.randomUUID() };
}
