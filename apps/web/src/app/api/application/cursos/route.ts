import { NextResponse } from 'next/server';
import { obterCatalogoCursos } from '@/server/application/catalogoCursos';
import { turmasAbertasPorCurso } from '@/server/application/turmasGestao';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * Catálogo público para o cadastro do psicólogo (1.01 e 2.01): cursos com as
 * permissões de atendimento e as turmas abertas de cada um. Sem dados pessoais.
 */
export async function GET() {
  try {
    const cursos = await obterCatalogoCursos();
    return NextResponse.json(
      { success: true, data: { cursos, turmasPorCurso: await turmasAbertasPorCurso(cursos) } },
      { headers: { 'Cache-Control': 'no-store' } }
    );
  } catch (error) {
    console.error('Erro ao carregar o catálogo de cursos:', error);
    return NextResponse.json({ success: false, error: 'Falha ao carregar os cursos.' }, { status: 500 });
  }
}
