import 'server-only';

import type { RequestContext } from './context';
import { ApplicationError } from './http';
import { parseAgendaBlockInput } from '@/server/scheduling/agendaBlockInput';
import {
  cancelAppointment,
  completeAppointment,
  createBlock,
  deleteBlock,
  getContatosDaSessao,
  getProfessionalAgendaProfile,
  listAppointments,
  listAvailability,
  listBlocks,
  replaceAvailability,
  type JanelaEditavel,
} from '@/server/scheduling/agendaRepository';
import { avisarSessaoCancelada } from '@/server/scheduling/agendaAvisos';

/**
 * A agenda pelo lado de quem atende.
 *
 * Toda função aqui começa resolvendo o perfil profissional da sessão e passa
 * esse par (organização, profissional) adiante. Nenhuma rota aceita o id do
 * profissional vindo do corpo: a agenda que o psicólogo edita é sempre a dele,
 * e deixar isso a cargo do cliente transformaria a aba em um editor da agenda
 * alheia.
 */

function perfilDaSessao(context: RequestContext): { organizationId: string; professionalId: string } {
  const professionalId = context.actor.professionalProfileId;
  if (!professionalId) {
    throw new ApplicationError(
      'FORBIDDEN',
      'A agenda está disponível apenas para perfis profissionais.',
      403
    );
  }
  return { organizationId: context.actor.organizationId, professionalId };
}

export async function getAgendaOverview(context: RequestContext) {
  const { organizationId, professionalId } = perfilDaSessao(context);
  const profile = await getProfessionalAgendaProfile(organizationId, professionalId);
  if (!profile) throw new ApplicationError('NOT_FOUND', 'Perfil profissional ativo não encontrado.', 404);

  // Sessões antigas ainda não confirmadas continuam visíveis pelo repositório;
  // as já encerradas permanecem por 90 dias para conferência e pagamento.
  const desde = new Date(Date.now() - 90 * 24 * 60 * 60_000);
  const [availability, blocks, appointments] = await Promise.all([
    listAvailability(organizationId, professionalId),
    listBlocks(organizationId, professionalId),
    listAppointments(organizationId, professionalId, desde),
  ]);

  return {
    professionalName: profile.professionalName,
    agendaToken: profile.token,
    availability,
    blocks,
    appointments,
  };
}

const HORA = /^([01]\d|2[0-3]):[0-5]\d$/;

/** Valida a grade inteira antes de gravar: meia grade salva é pior que nenhuma. */
export function parseAvailability(body: Record<string, unknown>): JanelaEditavel[] {
  const bruto = Array.isArray(body.availability) ? body.availability : null;
  if (!bruto) throw new ApplicationError('INVALID_INPUT', 'Envie a grade de horários.', 400);

  const janelas = bruto.map((item) => {
    const janela = item as Record<string, unknown>;
    const diaSemana = Number(janela.diaSemana);
    const horaInicio = String(janela.horaInicio ?? '');
    const horaFim = String(janela.horaFim ?? '');
    const duracaoMin = Number(janela.duracaoMin ?? 50);

    if (!Number.isInteger(diaSemana) || diaSemana < 0 || diaSemana > 6) {
      throw new ApplicationError('INVALID_INPUT', 'Dia da semana inválido.', 400);
    }
    if (!HORA.test(horaInicio) || !HORA.test(horaFim)) {
      throw new ApplicationError('INVALID_INPUT', 'Use horários no formato HH:MM.', 400);
    }
    if (horaFim <= horaInicio) {
      throw new ApplicationError(
        'INVALID_INPUT',
        `A janela de ${horaInicio} às ${horaFim} termina antes de começar.`,
        400
      );
    }
    if (!Number.isInteger(duracaoMin) || duracaoMin < 15 || duracaoMin > 240) {
      throw new ApplicationError('INVALID_INPUT', 'A duração deve ficar entre 15 e 240 minutos.', 400);
    }
    return {
      diaSemana,
      horaInicio,
      horaFim,
      duracaoMin,
      modalidade: janela.modalidade === 'online' ? 'online' : 'presencial',
    } as JanelaEditavel;
  });

  // Duas janelas sobrepostas no mesmo dia gerariam horários repetidos na tela
  // do paciente, e o banco só reclamaria se o início coincidisse exatamente.
  for (const [indice, janela] of janelas.entries()) {
    const conflito = janelas.slice(indice + 1).find(
      (outra) =>
        outra.diaSemana === janela.diaSemana &&
        outra.horaInicio < janela.horaFim &&
        outra.horaFim > janela.horaInicio
    );
    if (conflito) {
      throw new ApplicationError(
        'INVALID_INPUT',
        `As janelas de ${janela.horaInicio} e ${conflito.horaInicio} se sobrepõem no mesmo dia.`,
        400
      );
    }
  }

  return janelas;
}

export async function saveAvailability(context: RequestContext, janelas: readonly JanelaEditavel[]) {
  const { organizationId, professionalId } = perfilDaSessao(context);
  await replaceAvailability(organizationId, professionalId, janelas);
  return { availability: await listAvailability(organizationId, professionalId) };
}

/**
 * Bloqueio informado em datas locais e gravado em instantes absolutos.
 *
 * O profissional pensa "de 20 a 27 de setembro", não em UTC. O dia final entra
 * inteiro — bloquear até o dia 27 e ainda receber marcação às 15h do dia 27
 * seria exatamente o contrário do pedido.
 */
export async function addBlock(context: RequestContext, body: Record<string, unknown>) {
  const { organizationId, professionalId } = perfilDaSessao(context);
  const parsed = parseAgendaBlockInput(body);
  if (!parsed.ok) throw new ApplicationError('INVALID_INPUT', parsed.mensagem, 400);

  const resultado = await createBlock(organizationId, professionalId, parsed.intervalo);
  if (resultado === 'appointment_conflict') {
    throw new ApplicationError(
      'APPOINTMENT_CONFLICT',
      'Já existe uma sessão da clínica nesse período. Cancele ou reagende a sessão antes de bloquear.',
      409
    );
  }
  if (resultado === 'block_conflict') {
    throw new ApplicationError('BLOCK_CONFLICT', 'Esse período já possui um bloqueio.', 409);
  }
  return { blocks: await listBlocks(organizationId, professionalId) };
}

export async function removeBlock(context: RequestContext, blockId: string) {
  const { organizationId, professionalId } = perfilDaSessao(context);
  await deleteBlock(organizationId, professionalId, blockId);
  return { blocks: await listBlocks(organizationId, professionalId) };
}

export async function cancelAgendaAppointment(
  context: RequestContext,
  appointmentId: string,
  motivo: string
) {
  const { organizationId, professionalId } = perfilDaSessao(context);
  if (!motivo.trim()) {
    throw new ApplicationError('INVALID_INPUT', 'O motivo do cancelamento é obrigatório.', 400);
  }
  // Os contatos são lidos antes do UPDATE porque a mensagem fala do horário
  // que deixou de valer, e depois do cancelamento a linha continua lá mas o
  // aviso já não teria de onde tirar "sua sessão de quinta às 14h".
  const sessao = await getContatosDaSessao(appointmentId);
  const cancelado = await cancelAppointment(
    organizationId,
    professionalId,
    appointmentId,
    motivo.trim()
  );
  if (!cancelado) {
    throw new ApplicationError('NOT_FOUND', 'Agendamento não encontrado ou já cancelado.', 404);
  }
  if (sessao) await avisarSessaoCancelada(sessao);

  const desde = new Date(Date.now() - 90 * 24 * 60 * 60_000);
  return { appointments: await listAppointments(organizationId, professionalId, desde) };
}

export async function confirmAgendaAppointmentCompleted(
  context: RequestContext,
  appointmentId: string
) {
  const { organizationId, professionalId } = perfilDaSessao(context);
  const resultado = await completeAppointment(organizationId, professionalId, appointmentId);
  if (resultado === 'not_found') {
    throw new ApplicationError('NOT_FOUND', 'Agendamento não encontrado.', 404);
  }
  if (resultado === 'too_early') {
    throw new ApplicationError(
      'APPOINTMENT_NOT_FINISHED',
      'A realização só pode ser confirmada depois do horário previsto para o término.',
      409
    );
  }
  if (resultado === 'invalid_status') {
    throw new ApplicationError(
      'INVALID_APPOINTMENT_STATUS',
      'Somente uma sessão agendada ou confirmada pode ser marcada como realizada.',
      409
    );
  }

  const desde = new Date(Date.now() - 90 * 24 * 60 * 60_000);
  return { appointments: await listAppointments(organizationId, professionalId, desde) };
}
