import { NextResponse } from 'next/server';
import { getSessionPaymentProfile } from '@/server/payments/paymentLinkRepository';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ token: string }> }
) {
  const { token } = await params;
  if (!/^[a-f0-9]{32}$/.test(token)) {
    return NextResponse.json({ error: 'Link de pagamento inválido.' }, { status: 404 });
  }
  try {
    const profile = await getSessionPaymentProfile(token);
    if (!profile) {
      return NextResponse.json({ error: 'Sessão não encontrada ou cancelada.' }, { status: 404 });
    }
    return NextResponse.json(profile, { headers: { 'Cache-Control': 'private, no-store' } });
  } catch (error) {
    console.error('[pagamento-sessao] Falha ao carregar link:', error);
    return NextResponse.json({ error: 'Não foi possível carregar o pagamento agora.' }, { status: 500 });
  }
}

