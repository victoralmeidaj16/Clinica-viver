import 'server-only';

import type { RequestContext } from './context';
import { ApplicationError } from './http';
import { registrarFaltaDoAgendamento, situacaoCobrancaDaFalta, type ResultadoRegistroFalta } from '@/server/scheduling/agendaFalta';
import { listAppointments } from '@/server/scheduling/agendaRepository';
import { atualizarVencimentoCobrancaSessao, cancelarCobrancaDaSessao, garantirCobrancaDaSessao } from '@/server/payments/sessionCharge';

const PRAZO_COBRANCA_FALTA_MS = 3 * 24 * 60 * 60_000;

function falhaNaCobranca(detalhe: string) {
  return new ApplicationError('NO_SHOW_CHARGE_FAILED', `A falta foi registrada, mas ${detalhe}. Tente novamente para concluir.`, 502);
}

/**
 * A cobrança criada na marcação vence no horário da sessão, e a falta só existe
 * depois dele. Sem um prazo novo, o link recusaria o pagamento da falta cobrada.
 */
async function renovarVencimentoSePreciso(
  ator: { organizationId: string; professionalId: string; appointmentId: string },
  dueAt: string
) {
  const { vencida } = await situacaoCobrancaDaFalta(ator.organizationId, ator.professionalId, ator.appointmentId);
  if (!vencida) return;
  let resultado: Awaited<ReturnType<typeof atualizarVencimentoCobrancaSessao>>;
  try {
    resultado = await atualizarVencimentoCobrancaSessao({ ...ator, dueAt });
  } catch (cause) {
    console.error(`[agenda] Falha ao renovar o vencimento da falta ${ator.appointmentId}.`, cause);
    throw falhaNaCobranca('o vencimento da cobrança não pôde ser renovado');
  }
  // `paid`: o pagamento chegou nesse meio-tempo. `queued`: o ajuste será retomado.
  if (resultado === 'not_found' || resultado === 'invalid') {
    throw falhaNaCobranca('o vencimento da cobrança não pôde ser renovado');
  }
}

const RECUSAS: Record<Exclude<ResultadoRegistroFalta, 'recorded'>, [code: string, message: string, status: number]> = {
  not_found: ['NOT_FOUND', 'Agendamento não encontrado.', 404],
  stale: ['APPOINTMENT_CHANGED', 'A sessão foi alterada enquanto você registrava a falta. Atualize a agenda e tente de novo.', 409],
  too_early: ['APPOINTMENT_NOT_STARTED', 'A falta só pode ser registrada depois do horário de início da sessão.', 409],
  invalid_status: ['INVALID_APPOINTMENT_STATUS', 'Somente uma sessão agendada ou confirmada pode receber falta.', 409],
  charge_settled: ['CHARGE_SETTLED', 'Esta sessão já tem pagamento registrado. Registre a falta como cobrada; a devolução do valor é tratada à parte.', 409],
  missing_amount: ['SESSION_AMOUNT_MISSING', 'O valor desta sessão não está configurado, então a cobrança não pode ser criada.', 422],
};

/**
 * Falta na agenda do profissional logado, com a decisão de cobrar ou não.
 *
 * Nenhum aviso é enviado ao paciente. Cobrança e cancelamento são idempotentes:
 * quando o financeiro falha, a falta já está gravada e repetir o pedido conclui
 * só o que faltou.
 */
export async function registrarFaltaNaAgenda(
  context: RequestContext,
  appointmentId: string,
  input: { cobrar: boolean; expectedVersion?: number }
) {
  const { organizationId, professionalProfileId: professionalId } = context.actor;
  if (!professionalId) {
    throw new ApplicationError('FORBIDDEN', 'A agenda está disponível apenas para perfis profissionais.', 403);
  }

  const resultado = await registrarFaltaDoAgendamento(organizationId, professionalId, appointmentId, input);
  if (resultado !== 'recorded') {
    const [code, message, status] = RECUSAS[resultado];
    throw new ApplicationError(code, message, status);
  }

  if (input.cobrar) {
    const vencimento = new Date(Date.now() + PRAZO_COBRANCA_FALTA_MS).toISOString();
    const cobranca = await garantirCobrancaDaSessao(appointmentId, vencimento);
    if (cobranca === 'failed' || cobranca === 'skipped') throw falhaNaCobranca('a cobrança não pôde ser criada');
    await renovarVencimentoSePreciso({ organizationId, professionalId, appointmentId }, vencimento);
  } else {
    const cancelamento = await cancelarCobrancaDaSessao(appointmentId);
    if (cancelamento === 'failed') {
      throw new ApplicationError('CHARGE_CANCELLATION_FAILED', 'A falta foi registrada, mas a cobrança ainda não foi cancelada. Tente novamente para concluir.', 502);
    }
    // `kept` vale tanto para "não havia cobrança" quanto para "o provedor já recebeu".
    if (cancelamento === 'kept' && (await situacaoCobrancaDaFalta(organizationId, professionalId, appointmentId)).ativa) {
      throw new ApplicationError('CHARGE_SETTLED', 'A falta foi registrada, mas o provedor já recebeu o pagamento desta sessão. Ela fica como cobrada; a devolução do valor é tratada à parte.', 409);
    }
  }

  const desde = new Date(Date.now() - 90 * 24 * 60 * 60_000);
  return { appointments: await listAppointments(organizationId, professionalId, desde) };
}
