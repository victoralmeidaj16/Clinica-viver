import { NextResponse } from 'next/server';
import { exigirGestaoComAutor } from '@/server/application/autorGestao';
import { obterDemandasParaGestao, operarDemanda } from '@/server/application/catalogoDemandas';
import { falhaGestao } from '@/server/application/respostaGestao';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/** Demandas clínicas com histórico de alterações (3.4 e 13.02). */
export async function GET() {
  try {
    const { sessao } = await exigirGestaoComAutor();
    return NextResponse.json(
      { success: true, data: await obterDemandasParaGestao(sessao.organizationId) },
      { headers: { 'Cache-Control': 'no-store' } }
    );
  } catch (error) {
    return falhaGestao(error, 'Erro ao ler demandas', 'Falha ao carregar as demandas.');
  }
}

/** `acao`: ADICIONAR, RENOMEAR (com `novoNome`), DESATIVAR ou REATIVAR. */
export async function POST(request: Request) {
  try {
    const { sessao, autor } = await exigirGestaoComAutor();
    const corpo = (await request.json().catch(() => ({}))) as Record<string, unknown>;
    return NextResponse.json({ success: true, data: await operarDemanda(sessao.organizationId, corpo, autor) });
  } catch (error) {
    return falhaGestao(error, 'Erro ao alterar demanda', 'Falha ao alterar a demanda.');
  }
}
