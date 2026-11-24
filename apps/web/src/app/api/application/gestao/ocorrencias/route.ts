import { NextResponse } from 'next/server';
import { exigirGestaoComAutor } from '@/server/application/autorGestao';
import { listarOcorrencias, registrarDecisaoOcorrencia } from '@/server/application/ocorrenciasGestao';
import { falhaGestao } from '@/server/application/respostaGestao';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/** Ocorrências que precisam de decisão, com o histórico de decisões (13.06). */
export async function GET() {
  try {
    const { sessao } = await exigirGestaoComAutor();
    return NextResponse.json({ success: true, data: await listarOcorrencias(sessao) }, { headers: { 'Cache-Control': 'no-store' } });
  } catch (error) {
    return falhaGestao(error, 'Erro ao listar ocorrências', 'Falha ao carregar as ocorrências.');
  }
}

/** Registra a decisão da Gestão: próximo passo e situação. */
export async function POST(request: Request) {
  try {
    const { sessao, autor } = await exigirGestaoComAutor();
    const body = (await request.json().catch(() => ({}))) as Record<string, unknown>;
    return NextResponse.json({ success: true, data: await registrarDecisaoOcorrencia(sessao, autor, body) });
  } catch (error) {
    return falhaGestao(error, 'Erro ao registrar decisão', 'Falha ao registrar a decisão.');
  }
}
