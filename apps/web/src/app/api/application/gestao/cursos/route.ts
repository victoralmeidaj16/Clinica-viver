import { NextResponse } from 'next/server';
import { exigirGestaoComAutor } from '@/server/application/autorGestao';
import { obterCatalogoParaGestao, salvarCursoDoCatalogo } from '@/server/application/catalogoCursos';
import { falhaGestao } from '@/server/application/respostaGestao';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/** Catálogo de pós-graduações com o histórico das alterações (1.01 e 2.01). */
export async function GET() {
  try {
    const { sessao } = await exigirGestaoComAutor();
    return NextResponse.json(
      { success: true, data: await obterCatalogoParaGestao(sessao.organizationId) },
      { headers: { 'Cache-Control': 'no-store' } }
    );
  } catch (error) {
    return falhaGestao(error, 'Erro ao ler o catálogo de cursos', 'Falha ao carregar os cursos.');
  }
}

/** Cria um curso (sem `nomeOriginal`) ou altera um existente. */
export async function PUT(request: Request) {
  try {
    const { sessao, autor } = await exigirGestaoComAutor();
    const corpo = (await request.json().catch(() => ({}))) as Record<string, unknown>;
    const curso = await salvarCursoDoCatalogo(sessao.organizationId, corpo, autor);
    return NextResponse.json({ success: true, data: curso });
  } catch (error) {
    return falhaGestao(error, 'Erro ao salvar curso', 'Falha ao salvar o curso.');
  }
}
