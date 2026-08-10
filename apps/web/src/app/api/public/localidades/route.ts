import { NextResponse } from 'next/server';
import { isBrazilUf } from '@/lib/brazilLocations';
import {
  IBGE_CACHE_SECONDS,
  listarEstadosIbge,
  listarMunicipiosIbge,
} from '@/server/application/ibgeLocations';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  try {
    const uf = new URL(request.url).searchParams.get('uf')?.trim().toUpperCase();
    if (uf && !isBrazilUf(uf)) {
      return NextResponse.json({ success: false, error: 'UF inválida.' }, { status: 400 });
    }

    const data = uf
      ? (await listarMunicipiosIbge(uf)).map(({ id, nome }) => ({ id, nome }))
      : (await listarEstadosIbge()).map(({ id, sigla, nome }) => ({ id, sigla, nome }));

    return NextResponse.json(
      { success: true, data },
      { headers: { 'Cache-Control': `public, s-maxage=${IBGE_CACHE_SECONDS}, stale-while-revalidate=86400` } }
    );
  } catch (error) {
    console.error('Erro ao consultar localidades do IBGE:', error);
    return NextResponse.json({ success: false, error: 'Não foi possível carregar as localidades. Tente novamente.' }, { status: 503 });
  }
}
