import { NextResponse } from 'next/server';
import type { CertificateTemplate } from '@thats-life/core';
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

export async function GET(request: Request) {
  try {
    const url = new URL(request.url);
    const id = url.searchParams.get('id') || url.searchParams.get('courseId') || 'default';
    const template = await certificadosRepo.obterTemplate(id);
    return NextResponse.json({ ok: true, template });
  } catch (error) {
    console.error('Erro ao buscar template de certificado:', error);
    return NextResponse.json({ ok: false, error: 'Erro ao buscar template' }, { status: 500 });
  }
}

export async function PUT(request: Request) {
  if (!isAuthorized(request)) {
    return NextResponse.json({ ok: false, error: 'Acesso não autorizado' }, { status: 401 });
  }

  try {
    const body = await request.json();
    const template = body.template as CertificateTemplate;

    if (!template || !template.id) {
      return NextResponse.json({ ok: false, error: 'Template inválido' }, { status: 400 });
    }

    const salvo = await certificadosRepo.salvarTemplate(template);
    return NextResponse.json({ ok: true, template: salvo });
  } catch (error) {
    console.error('Erro ao salvar template de certificado:', error);
    return NextResponse.json({ ok: false, error: 'Erro ao salvar template' }, { status: 500 });
  }
}
