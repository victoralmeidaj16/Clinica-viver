import { NextResponse } from 'next/server';
import { certificadosRepo } from '@/server/certificados/certificadosRepository';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ codigo: string }> }
) {
  try {
    const { codigo } = await params;
    const cert = await certificadosRepo.porCodigo(codigo);

    if (!cert) {
      return NextResponse.json(
        { ok: false, error: 'Certificado não encontrado' },
        { status: 404 }
      );
    }

    return NextResponse.json({ ok: true, data: cert });
  } catch (error) {
    console.error('Erro ao validar certificado:', error);
    return NextResponse.json(
      { ok: false, error: 'Erro interno ao validar certificado' },
      { status: 500 }
    );
  }
}
