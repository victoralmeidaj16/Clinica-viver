import { NextResponse } from 'next/server';
import { exigirGestaoComAutor } from '@/server/application/autorGestao';
import { falhaGestao } from '@/server/application/respostaGestao';
import { executarAcaoTurma, obterPainelTurmas, salvarConfiguracaoTurmas } from '@/server/application/turmasGestao';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/** Turmas por curso, com situação, data de saída e psicólogos vinculados (1.01–1.05). */
export async function GET() {
  try {
    const { sessao } = await exigirGestaoComAutor();
    return NextResponse.json(
      { success: true, data: await obterPainelTurmas(sessao.organizationId) },
      { headers: { 'Cache-Control': 'no-store' } }
    );
  } catch (error) {
    return falhaGestao(error, 'Erro ao ler turmas', 'Falha ao carregar as turmas.');
  }
}

/** `acao`: CRIAR, EDITAR, ENCERRAR, REABRIR, ALTERAR_ENCERRAMENTO, ALTERAR_SAIDA, INTERROMPER_RETIRADA ou RETOMAR_RETIRADA. */
export async function POST(request: Request) {
  try {
    const { sessao, autor } = await exigirGestaoComAutor();
    const corpo = (await request.json().catch(() => ({}))) as Record<string, unknown>;
    return NextResponse.json({ success: true, data: await executarAcaoTurma(sessao.organizationId, corpo, autor) });
  } catch (error) {
    return falhaGestao(error, 'Erro ao alterar turma', 'Falha ao alterar a turma.');
  }
}

/** Prazo de saída da vitrine e avisos da contagem (1.02–1.03). */
export async function PUT(request: Request) {
  try {
    const { sessao, autor } = await exigirGestaoComAutor();
    const corpo = (await request.json().catch(() => ({}))) as Record<string, unknown>;
    return NextResponse.json({ success: true, data: await salvarConfiguracaoTurmas(sessao.organizationId, corpo, autor) });
  } catch (error) {
    return falhaGestao(error, 'Erro ao salvar configuração das turmas', 'Falha ao salvar a configuração.');
  }
}
