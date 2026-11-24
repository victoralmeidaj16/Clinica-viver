import 'server-only';
import { isMysqlConfigured } from '@/server/oci/runtime';
import { atualizarVencimentoPorCobranca } from '@/server/payments/chargeDueByCharge';
import type { RequestContext } from './context';
import { ApplicationError } from './http';

/** Edição de vencimento pela gestão, no painel Financeiro & Repasses. */
export async function updateClinicChargeDue(context: RequestContext, chargeId: string, body: unknown) {
  if (!context.actor.roles.some((role) => role === 'admin' || role === 'owner')) {
    throw new ApplicationError('FORBIDDEN', 'Somente administradores podem alterar o vencimento.', 403);
  }
  const dueAt = body && typeof body === 'object' ? (body as Record<string, unknown>).dueAt : undefined;
  if (typeof dueAt !== 'string' || !Number.isFinite(Date.parse(dueAt))) {
    throw new ApplicationError('INVALID_INPUT', 'Informe um vencimento válido.', 400);
  }
  if (!isMysqlConfigured()) {
    throw new ApplicationError('UNAVAILABLE', 'A alteração de vencimento exige o banco de dados configurado.', 503);
  }
  const outcome = await atualizarVencimentoPorCobranca({
    organizationId: context.actor.organizationId, chargeId, dueAt: new Date(dueAt).toISOString(),
  });
  if (outcome === 'not_found') throw new ApplicationError('NOT_FOUND', 'Cobrança não encontrada.', 404);
  if (outcome === 'rejected') throw new ApplicationError('BANK_DUE_REJECTED', 'A instituição não confirmou o saldo e o prazo solicitados.', 409);
  if (outcome === 'paid') throw new ApplicationError('CHARGE_SETTLED', 'O vencimento não pode ser alterado após o pagamento.', 409);
  if (outcome === 'invalid') throw new ApplicationError('INVALID_INPUT', 'O vencimento deve estar no futuro.', 400);
  if (outcome === 'covered') throw new ApplicationError('INVALID_STATE', 'Esta sessão é paga pelo convênio. O prazo é o da fatura do convênio.', 409);
  // Um pedido pendente conserva o vencimento vigente até a confirmação bancária.
  return { updated: outcome === 'updated', pending: outcome === 'queued' };
}
