import { NextResponse } from 'next/server';
import { readSession } from '@/server/auth';
import { getCaptureRepository } from '@/server/persistence/captureRepository';
import { getLeiturasRepository } from '@/server/persistence/notificacoesLeituras';
import { cadastroDaSessao, SemAcessoError } from '@/server/application/psychologistSelf';
import {
  montarLista,
  notificacoesDeAgendamentos,
  notificacoesDaGestao,
  notificacoesDePagamento,
  notificacoesDePerfilAlterado,
  notificacoesDoPsicologo,
  type NotificacaoDerivada,
} from '@/server/application/notificacoes';
import { getApplicationStore } from '@/server/application/store';
import { listRecentConfirmedPayments } from '@/server/payments/paymentLinkRepository';
import { getPerfilAlteracoesRepository } from '@/server/persistence/perfilAlteracoes';
import { isMysqlConfigured } from '@/server/oci/runtime';
import { listAppointments } from '@/server/scheduling/agendaRepository';

/** Janela de eventos consultada; a retenção do sino já corta em 30 dias. */
const DIAS_DE_HISTORICO = 30;

function inicioDaJanela(): Date {
  return new Date(Date.now() - DIAS_DE_HISTORICO * 24 * 60 * 60 * 1000);
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
    const membership = await getApplicationStore().identities.findMembershipByUser(
      organizationId,
      userId
    );
    const professionalId = membership?.professionalProfileId;
    if (!professionalId) return [];
    const desde = inicioDaJanela();
    return notificacoesDePagamento(
      await listRecentConfirmedPayments(organizationId, professionalId, desde)
    );
  } catch (error) {
    console.error('Erro ao ler pagamentos para o sino:', error);
    return [];
  }
}

async function agendamentosDoPsicologo(
  organizationId: string,
  userId: string
): Promise<NotificacaoDerivada[]> {
  if (!isMysqlConfigured()) return [];
  try {
    const membership = await getApplicationStore().identities.findMembershipByUser(
      organizationId,
      userId
    );
    const professionalId = membership?.professionalProfileId;
    if (!professionalId) return [];
    const desde = inicioDaJanela();
    return notificacoesDeAgendamentos(
      await listAppointments(organizationId, professionalId, desde)
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

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * Notificações de quem está logado.
 *
 * O papel da sessão decide qual lista é montada, e essa é a única fronteira que
 * importa aqui: a lista da gestão nomeia pacientes de toda a clínica, e a do
 * profissional só os que estão — ou estiveram — na fila dele. Um psicólogo sem
 * cadastro vinculado recebe lista vazia em vez de cair na lista da gestão.
 *
 * A varredura de SLA não roda nesta rota, de propósito: o sino é consultado em
 * segundo plano, a cada minuto, e transbordar um paciente como efeito colateral
 * de uma leitura de fundo tiraria a decisão de quem está olhando para a fila.
 * Quem varre continua sendo o cockpit e o agendador.
 */
export async function GET() {
  try {
    const session = await readSession();
    if (!session) {
      return NextResponse.json(
        { success: false, error: 'Faça login para ver suas notificações.' },
        { status: 401 }
      );
    }

    const state = await getCaptureRepository().read();
    const agora = new Date();

    const derivadas =
      session.role === 'admin'
        ? [...notificacoesDaGestao(state, agora), ...(await alteracoesDePerfil())]
        : await (async () => {
            const cadastro = await cadastroDaSessao(session);
            if (!cadastro) return [];
            return [
              ...notificacoesDoPsicologo(state, cadastro, agora),
              ...(await agendamentosDoPsicologo(session.organizationId, session.userId)),
              ...(await pagamentosDoPsicologo(session.organizationId, session.userId)),
            ];
          })();

    const lidas = await getLeiturasRepository().lidas(session.userId);
    const lista = montarLista(derivadas, lidas, agora);

    return NextResponse.json(
      { success: true, data: lista },
      { headers: { 'Cache-Control': 'no-store' } }
    );
  } catch (error) {
    if (error instanceof SemAcessoError) {
      return NextResponse.json({ success: false, error: error.message }, { status: error.status });
    }
    console.error('Erro ao montar as notificações:', error);
    return NextResponse.json(
      { success: false, error: 'Falha ao carregar as notificações.' },
      { status: 500 }
    );
  }
}
