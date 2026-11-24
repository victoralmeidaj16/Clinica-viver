import 'server-only';

import { alteracoesRecentesDoProfissional } from '@/server/persistence/mysql/agendamentoAlteracoesRepository';
import { notificacoesDeCorrecaoDaGestao } from './notificacoesCorrecaoAgenda';
import type { AuthSession } from '@/server/auth';
import { getCaptureRepository } from '@/server/persistence/captureRepository';
import { cadastroDaSessao } from '@/server/application/psychologistSelf';
import {
  notificacoesDeAceiteSemAgendamento,
  notificacoesDeAgendamentos,
  notificacoesDaGestao,
  notificacoesDeCobrancasVencidas,
  notificacoesDePagamento,
  notificacoesDePerfilAlterado,
  notificacoesDoPsicologo,
  type NotificacaoDerivada,
} from '@/server/application/notificacoes';
import { getApplicationStore } from '@/server/application/store';
import {
  listOverdueChargesForProfessional,
  listRecentConfirmedPayments,
} from '@/server/payments/paymentLinkRepository';
import { getPerfilAlteracoesRepository } from '@/server/persistence/perfilAlteracoes';
import { isMysqlConfigured } from '@/server/oci/runtime';
import { listAppointments } from '@/server/scheduling/agendaRepository';
import { agendamentosDosPacientes } from '@/server/persistence/mysql/primeiroAgendamento';
import type { CaptureState } from '@/server/persistence/captureRepository';

/**
 * A lista de notificações de quem está logado, antes da marca de leitura.
 *
 * Um único lugar para o sino e para o "marcar como lida": a marcação só grava
 * chaves que estão nesta lista, então uma rota que montasse uma lista menor
 * deixaria de fora justamente os avisos que ela não conhece — e eles voltariam
 * como não lidos na consulta seguinte.
 */

/** Janela de eventos consultada; a retenção do sino já corta em 30 dias. */
const DIAS_DE_HISTORICO = 30;

function inicioDaJanela(): Date {
  return new Date(Date.now() - DIAS_DE_HISTORICO * 24 * 60 * 60 * 1000);
}

async function profissionalDaSessao(organizationId: string, userId: string): Promise<string | null> {
  const membership = await getApplicationStore().identities.findMembershipByUser(
    organizationId,
    userId
  );
  return membership?.professionalProfileId ?? null;
}

/**
 * Pagamentos dos pacientes de quem está logado.
 *
 * Falha em silêncio de propósito: o sino existe para a fila de triagem, e uma
 * indisponibilidade do financeiro não pode derrubar o aviso de que alguém está
 * há dois dias sem primeiro contato.
 */
async function pagamentosDoPsicologo(
  organizationId: string,
  userId: string
): Promise<NotificacaoDerivada[]> {
  if (!isMysqlConfigured()) return [];
  try {
    const professionalId = await profissionalDaSessao(organizationId, userId);
    if (!professionalId) return [];
    const desde = inicioDaJanela();
    const [pagamentos, vencidas] = await Promise.all([
      listRecentConfirmedPayments(organizationId, professionalId, desde),
      listOverdueChargesForProfessional(organizationId, professionalId, desde),
    ]);
    return [...notificacoesDePagamento(pagamentos), ...notificacoesDeCobrancasVencidas(vencidas)];
  } catch (error) {
    console.error('Erro ao ler pagamentos para o sino:', error);
    return [];
  }
}

export async function correcoesDaGestao(organizationId: string, userId: string): Promise<NotificacaoDerivada[]> {
  if (!isMysqlConfigured()) return [];
  try {
    const professionalId = await profissionalDaSessao(organizationId, userId);
    if (!professionalId) return [];
    return notificacoesDeCorrecaoDaGestao(
      await alteracoesRecentesDoProfissional(organizationId, professionalId, inicioDaJanela())
    );
  } catch {
    console.error('[agenda] Falha ao consultar correções da Gestão para o sino.');
    return [];
  }
}

async function agendamentosDoPsicologo(
  organizationId: string,
  userId: string
): Promise<NotificacaoDerivada[]> {
  if (!isMysqlConfigured()) return [];
  try {
    const professionalId = await profissionalDaSessao(organizationId, userId);
    if (!professionalId) return [];
    return notificacoesDeAgendamentos(
      await listAppointments(organizationId, professionalId, inicioDaJanela())
    );
  } catch (error) {
    console.error('Erro ao ler agendamentos para o sino:', error);
    return [];
  }
}

/**
 * Alterações de perfil dos psicólogos, para o sino da gestão.
 *
 * Falha em silêncio pelo mesmo motivo dos pagamentos: saber que alguém trocou a
 * minibio não pode custar o aviso de que um paciente está há dois dias sem
 * primeiro contato.
 */
async function alteracoesDePerfil(): Promise<NotificacaoDerivada[]> {
  try {
    return notificacoesDePerfilAlterado(
      await getPerfilAlteracoesRepository().recentes(inicioDaJanela())
    );
  } catch (error) {
    console.error('Erro ao ler alterações de perfil para o sino:', error);
    return [];
  }
}

/**
 * Aviso de 48h sem primeiro agendamento (especificação 7.03). Falha em
 * silêncio, como os demais complementos: sem a agenda não há como afirmar que
 * falta agendamento, e um aviso falso é pior que a ausência dele.
 */
async function aceitesSemAgendamento(
  organizationId: string,
  state: CaptureState,
  agora: Date
): Promise<NotificacaoDerivada[]> {
  if (!isMysqlConfigured()) return [];
  try {
    const pacienteRefs = state.triagensPacientes
      .filter((lead) => lead.aceitoEm && lead.pacienteRef)
      .map((lead) => lead.pacienteRef!);
    const agendamentos = await agendamentosDosPacientes(organizationId, pacienteRefs);
    return notificacoesDeAceiteSemAgendamento(state, agendamentos, agora);
  } catch (error) {
    console.error('Erro ao ler agendamentos para o aviso de 48h:', error);
    return [];
  }
}

/**
 * O papel da sessão decide qual lista é montada: a da gestão nomeia pacientes
 * de toda a clínica, e a do profissional só os que estão — ou estiveram — na
 * fila dele. Um psicólogo sem cadastro vinculado recebe lista vazia.
 */
export async function notificacoesDaSessao(
  session: AuthSession,
  agora: Date
): Promise<NotificacaoDerivada[]> {
  const state = await getCaptureRepository().read();
  if (session.role === 'admin') {
    return [
      ...notificacoesDaGestao(state, agora),
      ...(await aceitesSemAgendamento(session.organizationId, state, agora)),
      ...(await alteracoesDePerfil()),
    ];
  }
  if (session.role === 'financeiro') return [];
  const cadastro = await cadastroDaSessao(session);
  const correcoes = await correcoesDaGestao(session.organizationId, session.userId);
  if (!cadastro) return correcoes;
  return [
    ...notificacoesDoPsicologo(state, cadastro, agora),
    ...correcoes,
    ...(await agendamentosDoPsicologo(session.organizationId, session.userId)),
    ...(await pagamentosDoPsicologo(session.organizationId, session.userId)),
  ];
}
