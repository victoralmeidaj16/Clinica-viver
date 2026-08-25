import { NextResponse } from 'next/server';
import type { CertificateStatus } from '@thats-life/core';
import { certificadosRepo } from '@/server/certificados/certificadosRepository';
import { proxyToPersistentBackend } from '@/server/http/persistentBackendProxy';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const ADMIN_PIN = process.env.CERTIFICADOS_ADMIN_PIN || 'viver2026';

function isAuthorized(request: Request): boolean {
  const pinHeader = request.headers.get('x-admin-pin');
  const url = new URL(request.url);
  const pinQuery = url.searchParams.get('pin');
  return (pinHeader === ADMIN_PIN || pinQuery === ADMIN_PIN);
}

export async function GET(request: Request) {
  const proxied = await proxyToPersistentBackend(request);
  if (proxied) return proxied;

  if (!isAuthorized(request)) {
    return NextResponse.json({ ok: false, error: 'Acesso não autorizado' }, { status: 401 });
  }

  try {
    const url = new URL(request.url);
    const busca = url.searchParams.get('busca') ?? undefined;
    const statusParam = url.searchParams.get('status');
    const status = (statusParam && statusParam !== 'all' ? statusParam as CertificateStatus : undefined);

    const certificados = await certificadosRepo.listar({ busca, status });
    return NextResponse.json({ ok: true, data: certificados });
  } catch (error) {
    console.error('Erro ao listar certificados:', error);
    return NextResponse.json({ ok: false, error: 'Erro interno ao listar certificados' }, { status: 500 });
  }
}

export async function POST(request: Request) {
  const proxied = await proxyToPersistentBackend(request);
  if (proxied) return proxied;

  if (!isAuthorized(request)) {
    return NextResponse.json({ ok: false, error: 'Acesso não autorizado' }, { status: 401 });
  }

  try {
    const body = await request.json();
    if (!body.studentName || !body.courseTitle || !body.durationHours || !body.issueDate) {
      return NextResponse.json(
        { ok: false, error: 'Campos obrigatórios: studentName, courseTitle, durationHours, issueDate' },
        { status: 400 }
      );
    }

    const novo = await certificadosRepo.emitir({
      code: body.code,
      studentName: body.studentName,
      studentCpf: body.studentCpf,
      studentEmail: body.studentEmail,
      courseTitle: body.courseTitle,
      durationHours: body.durationHours,
      issueDate: body.issueDate,
      startDate: body.startDate,
      completionDate: body.completionDate,
      frontImageUrl: body.frontImageUrl,
      backImageUrl: body.backImageUrl,
      stampX: body.stampX,
      stampY: body.stampY,
      stampFontSize: body.stampFontSize,
      stampAlign: body.stampAlign || 'center',
      signerInfo: body.signerInfo,
      validationUrl: body.validationUrl,
      createdBy: body.createdBy || 'diretoria@viver.com',
    });

    return NextResponse.json({ ok: true, data: novo }, { status: 201 });
  } catch (error) {
    console.error('Erro ao emitir certificado:', error);
    return NextResponse.json({ ok: false, error: 'Erro interno ao emitir certificado' }, { status: 500 });
  }
}
