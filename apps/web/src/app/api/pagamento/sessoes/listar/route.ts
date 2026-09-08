import { NextResponse } from 'next/server';
import { rateLimited, validCpf } from '@/server/http/publicRequest';
import { listPayablePatientSessions } from '@/server/payments/paymentLinkRepository';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(request: Request) {
  if (rateLimited(request, 'pagamento-sessoes-listar')) {
    return NextResponse.json({ error: 'Muitas tentativas. Aguarde alguns minutos.' }, { status: 429 });
  }
  try {
    const body = await request.json() as Record<string, unknown>;
    const token = String(body.token ?? '');
    const cpf = String(body.cpf ?? '').replace(/\D/g, '');
    if (!/^[a-f0-9]{32}$/.test(token) || !validCpf(cpf)) {
      return NextResponse.json({ error: 'Confira o CPF informado.' }, { status: 400 });
    }
    const sessions = await listPayablePatientSessions({ token, cpf });
    if (sessions.length === 0) return NextResponse.json({ error: 'Nenhuma sessão em aberto foi encontrada.' }, { status: 404 });
    return NextResponse.json({ sessions }, { headers: { 'Cache-Control': 'private, no-store' } });
  } catch (error) {
    console.error('[pagamento-sessoes] Falha ao listar cobranças:', error);
    return NextResponse.json({ error: 'Não foi possível consultar as sessões agora.' }, { status: 500 });
  }
}
