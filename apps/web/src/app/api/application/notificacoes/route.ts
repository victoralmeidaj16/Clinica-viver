import { NextResponse } from 'next/server';
import { readSession } from '@/server/auth';
import { getCaptureRepository } from '@/server/persistence/captureRepository';
import { getLeiturasRepository } from '@/server/persistence/notificacoesLeituras';
import { cadastroDaSessao, SemAcessoError } from '@/server/application/psychologistSelf';
import {
  montarLista,
  notificacoesDaGestao,
  notificacoesDoPsicologo,
} from '@/server/application/notificacoes';

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
        ? notificacoesDaGestao(state, agora)
        : await (async () => {
            const cadastro = await cadastroDaSessao(session);
            return cadastro ? notificacoesDoPsicologo(state, cadastro, agora) : [];
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
