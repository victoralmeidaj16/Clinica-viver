import { NextResponse } from 'next/server';
import { organizacaoPadrao } from '@/server/application/configuracaoGestao';
import { listarConveniosPublicos } from '@/server/persistence/mysql/convenioRepository';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    return NextResponse.json({ convenios: await listarConveniosPublicos(organizacaoPadrao()) }, { headers: { 'Cache-Control': 'public, max-age=300' } });
  } catch (error) {
    console.error('[convenios-publicos] Falha ao listar:', error);
    return NextResponse.json({ convenios: [], error: 'Lista temporariamente indisponível.' }, { status: 503 });
  }
}
