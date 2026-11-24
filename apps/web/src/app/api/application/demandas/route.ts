import { NextResponse } from 'next/server';
import { demandasAtivas } from '@/lib/catalogoDemandas';
import { obterDemandas } from '@/server/application/catalogoDemandas';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/** Demandas clínicas oferecidas no site e nos cadastros (3.4). */
export async function GET() {
  try {
    return NextResponse.json(
      { success: true, data: { demandas: demandasAtivas(await obterDemandas()) } },
      { headers: { 'Cache-Control': 'no-store' } }
    );
  } catch (error) {
    console.error('Erro ao carregar as demandas clínicas:', error);
    return NextResponse.json({ success: false, error: 'Falha ao carregar as demandas.' }, { status: 500 });
  }
}
