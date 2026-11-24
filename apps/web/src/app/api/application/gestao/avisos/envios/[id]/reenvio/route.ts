import { NextResponse } from 'next/server';
import { exigirGestaoComAutor } from '@/server/application/autorGestao';
import { reenviarAviso } from '@/server/application/reenvioAviso';
import { falhaGestao } from '@/server/application/respostaGestao';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/** Reenvia um aviso não entregue, sem recriar solicitação ou agendamento (12.04). */
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { autor } = await exigirGestaoComAutor();
    const { id } = await params;
    const body = (await request.json().catch(() => ({}))) as Record<string, unknown>;
    const resultado = await reenviarAviso(id, autor, { confirmarResultadoIncerto: body.confirmarResultadoIncerto === true });
    return NextResponse.json({ success: true, data: { situacao: resultado.situacao } });
  } catch (error) {
    return falhaGestao(error, 'Erro ao reenviar aviso', 'Falha ao reenviar o aviso.');
  }
}
