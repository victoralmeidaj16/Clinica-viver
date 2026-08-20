import { getAsaasIntegrationStatus } from '@/server/adapters/asaasAdapter';
import { resolveRequestContext } from '@/server/application/context';
import { ApplicationError, failure, success } from '@/server/application/http';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/** Diagnóstico operacional do Asaas, sem expor chave de API ou token do webhook. */
export async function GET(request: Request) {
  try {
    const context = await resolveRequestContext(request);
    const isAdmin = context.actor.roles.some((role) => role === 'owner' || role === 'admin');
    if (!isAdmin) {
      throw new ApplicationError(
        'FORBIDDEN',
        'A configuração do Asaas é visível apenas para a administração da clínica.',
        403
      );
    }
    return success(await getAsaasIntegrationStatus());
  } catch (error) {
    return failure(error);
  }
}
