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
 * Marca notificações como lidas.
 *
 * Aceita `{ chaves: [...] }` para itens específicos e `{ todas: true }` para o
 * "marcar todas". Nos dois casos a lista visível é remontada no servidor e só
 * as chaves que estão nela são gravadas: a marca de leitura é derivada do que a
 * pessoa poderia de fato ver, e não do que o corpo da requisição afirma. Sem
 * isso, qualquer sessão poderia encher a tabela com chaves inventadas.
 */
export async function POST(request: Request) {
  try {
    const session = await readSession();
    if (!session) {
      return NextResponse.json(
        { success: false, error: 'Faça login para continuar.' },
        { status: 401 }
      );
    }

    const corpo = (await request.json().catch(() => ({}))) as {
      chaves?: unknown;
      todas?: unknown;
    };
    const pedidas = Array.isArray(corpo.chaves)
      ? corpo.chaves.filter((chave): chave is string => typeof chave === 'string')
      : [];
    const todas = corpo.todas === true;

    if (!todas && pedidas.length === 0) {
      return NextResponse.json(
        { success: false, error: 'Informe as chaves a marcar como lidas.' },
        { status: 400 }
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
    const visiveis = new Set(lista.itens.map((item) => item.chave));

    const marcar = todas
      ? lista.itens.filter((item) => !item.lida).map((item) => item.chave)
      : pedidas.filter((chave) => visiveis.has(chave));

    await getLeiturasRepository().marcar(session.userId, marcar);

    const atualizada = montarLista(derivadas, new Set([...lidas, ...marcar]), agora);
    return NextResponse.json(
      { success: true, data: atualizada },
      { headers: { 'Cache-Control': 'no-store' } }
    );
  } catch (error) {
    if (error instanceof SemAcessoError) {
      return NextResponse.json({ success: false, error: error.message }, { status: error.status });
    }
    console.error('Erro ao marcar notificações como lidas:', error);
    return NextResponse.json(
      { success: false, error: 'Falha ao marcar as notificações.' },
      { status: 500 }
    );
  }
}
