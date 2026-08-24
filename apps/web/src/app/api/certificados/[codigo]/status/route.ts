import { NextResponse } from 'next/server';
import type { CertificateStatus } from '@thats-life/core';
import { certificadosRepo } from '@/server/certificados/certificadosRepository';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const ADMIN_PIN = process.env.CERTIFICADOS_ADMIN_PIN || 'viver2026';

function isAuthorized(request: Request): boolean {
  const pinHeader = request.headers.get('x-admin-pin');
  const url = new URL(request.url);
  const pinQuery = url.searchParams.get('pin');
  return (pinHeader === ADMIN_PIN || pinQuery === ADMIN_PIN);
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ codigo: string }> }
) {
  if (!isAuthorized(request)) {
    return NextResponse.json({ ok: false, error: 'Acesso não autorizado' }, { status: 401 });
  }

  try {
    const { codigo } = await params;
    const body = await request.json();

    if (!body.status || !['valid', 'revoked', 'cancelled'].includes(body.status)) {
      return NextResponse.json(
        { ok: false, error: 'Status inválido. Deve ser: valid, revoked ou cancelled' },
        { status: 400 }
      );
    }

    const sucesso = await certificadosRepo.atualizarStatus(
      codigo,
      body.status as CertificateStatus,
      body.motivo,
      body.revogadoPor || 'diretoria@viver.com'
    );

    if (!sucesso) {
      return NextResponse.json(
        { ok: false, error: 'Certificado não encontrado para atualização' },
        { status: 404 }
      );
    }

    const atualizado = await certificadosRepo.porCodigo(codigo);
    return NextResponse.json({ ok: true, data: atualizado });
  } catch (error) {
    console.error('Erro ao atualizar status do certificado:', error);
    return NextResponse.json(
      { ok: false, error: 'Erro interno ao atualizar status' },
      { status: 500 }
    );
  }
}
