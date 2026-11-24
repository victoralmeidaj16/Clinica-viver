import { NextResponse } from 'next/server';
import { exigirGestaoComAutor } from '@/server/application/autorGestao';
import { alterarPrazoOferta, obterPrazoOferta } from '@/server/application/configuracaoGestao';
import { falhaGestao } from '@/server/application/respostaGestao';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/** Prazo atual das ofertas e o histórico de mudanças (5.02 e 13.02). */
export async function GET() {
  try {
    const { sessao } = await exigirGestaoComAutor();
    return NextResponse.json(
      { success: true, data: { prazoOferta: await obterPrazoOferta(sessao.organizationId) } },
      { headers: { 'Cache-Control': 'no-store' } }
    );
  } catch (error) {
    return falhaGestao(error, 'Erro ao ler configurações', 'Falha ao carregar as configurações.');
  }
}

/** Altera o prazo das próximas ofertas. As já enviadas mantêm o prazo original. */
export async function PUT(request: Request) {
  try {
    const { sessao, autor } = await exigirGestaoComAutor();
    const body = (await request.json().catch(() => ({}))) as Record<string, unknown>;
    const prazoOferta = await alterarPrazoOferta(sessao.organizationId, body.prazoOfertaHoras, autor);
    return NextResponse.json({ success: true, data: { prazoOferta } });
  } catch (error) {
    return falhaGestao(error, 'Erro ao alterar configurações', 'Falha ao salvar as configurações.');
  }
}
