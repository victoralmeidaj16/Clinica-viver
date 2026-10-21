import { NextResponse } from 'next/server';
import { readSession } from '@/server/auth';
import { getLeiturasRepository } from '@/server/persistence/notificacoesLeituras';
import { SemAcessoError } from '@/server/application/psychologistSelf';
import { montarLista } from '@/server/application/notificacoes';
import { notificacoesDaSessao } from '@/server/application/notificacoesDaSessao';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * Notificações de quem está logado.
 *
 * A lista é montada por `notificacoesDaSessao`, a mesma que o "marcar como
 * lida" usa — é o que garante que tudo o que o sino mostra possa ser marcado.
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

    const agora = new Date();
    const derivadas = await notificacoesDaSessao(session, agora);
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
