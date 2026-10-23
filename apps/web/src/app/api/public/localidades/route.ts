import { NextResponse } from 'next/server';
import { isBrazilUf } from '@/lib/brazilLocations';
import {
  listarEstadosBrasileiros,
  listarMunicipiosBrasileiros,
} from '@/server/application/brazilLocalities';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  const uf = new URL(request.url).searchParams.get('uf')?.trim().toUpperCase();
  if (uf && !isBrazilUf(uf)) {
    return NextResponse.json({ success: false, error: 'UF inválida.' }, { status: 400 });
  }

  const data = uf
    ? listarMunicipiosBrasileiros(uf)
    : listarEstadosBrasileiros();

  return NextResponse.json(
    { success: true, data },
    { headers: { 'Cache-Control': 'public, s-maxage=604800, stale-while-revalidate=86400' } }
  );
}
