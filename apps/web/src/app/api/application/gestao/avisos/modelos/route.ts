import { NextResponse } from 'next/server';
import { exigirGestaoComAutor } from '@/server/application/autorGestao';
import { listarModelosParaEditor, salvarModeloDoAviso } from '@/server/application/modelosAvisos';
import { falhaGestao } from '@/server/application/respostaGestao';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/** Modelos dos avisos, com canal, ativação e histórico de versões (12.01–12.02). */
export async function GET() {
  try {
    const { sessao } = await exigirGestaoComAutor();
    return NextResponse.json(
      { success: true, data: await listarModelosParaEditor(sessao.organizationId) },
      { headers: { 'Cache-Control': 'no-store' } }
    );
  } catch (error) {
    return falhaGestao(error, 'Erro ao ler modelos de avisos', 'Falha ao carregar os modelos.');
  }
}

/** Grava uma nova versão do texto, do canal ou da ativação de um aviso. */
export async function PUT(request: Request) {
  try {
    const { sessao, autor } = await exigirGestaoComAutor();
    const body = (await request.json().catch(() => ({}))) as Record<string, unknown>;
    const modelo = await salvarModeloDoAviso(sessao.organizationId, body.finalidade,
      { texto: body.texto, canal: body.canal, ativo: body.ativo }, autor);
    return NextResponse.json({ success: true, data: modelo });
  } catch (error) {
    return falhaGestao(error, 'Erro ao salvar modelo de aviso', 'Falha ao salvar o modelo.');
  }
}
