import { NextResponse } from 'next/server';
import { exigirGestaoComAutor } from '@/server/application/autorGestao';
import { falhaGestao } from '@/server/application/respostaGestao';
import { decidirVinculoDoCadastro } from '@/server/application/vinculosGestao';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * Decisão da Gestão sobre um vínculo acadêmico (2.02 e 3.10). Corpo:
 * `{ papel: 'PRINCIPAL' | 'SEGUNDA', status, motivo?, validoAte? }` ou
 * `{ papel, acao: 'TURMA', turma }` para corrigir a turma do vínculo.
 */
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { autor } = await exigirGestaoComAutor();
    const { id } = await params;
    const corpo = (await request.json().catch(() => ({}))) as Record<string, unknown>;
    return NextResponse.json({ success: true, data: await decidirVinculoDoCadastro(decodeURIComponent(id), corpo, autor) });
  } catch (error) {
    return falhaGestao(error, 'Erro ao decidir vínculo acadêmico', 'Falha ao atualizar o vínculo acadêmico.');
  }
}
