import { timingSafeEqual } from 'node:crypto';
import { NextResponse } from 'next/server';
import { reconcileAsaasPayment } from '@/server/payments/paymentLinkRepository';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

function authorized(received: string | null, expected: string): boolean {
  if (!received) return false;
  const left = Buffer.from(received);
  const right = Buffer.from(expected);
  return left.length === right.length && timingSafeEqual(left, right);
}

export async function POST(request: Request) {
  const expectedToken = process.env.ASAAS_WEBHOOK_TOKEN?.trim();
  if (!expectedToken) {
    console.error('[asaas-webhook] ASAAS_WEBHOOK_TOKEN não configurado.');
    return NextResponse.json({ error: 'Webhook indisponível.' }, { status: 503 });
  }
  if (!authorized(request.headers.get('asaas-access-token'), expectedToken)) {
    return NextResponse.json({ error: 'Não autorizado.' }, { status: 401 });
  }

  try {
    const payload = await request.json() as Record<string, unknown>;
    const payment = payload.payment as Record<string, unknown> | undefined;
    const eventType = String(payload.event ?? '');
    const paymentId = String(payment?.id ?? '');
    if (!paymentId || !eventType) {
      return NextResponse.json({ error: 'Evento inválido.' }, { status: 400 });
    }
    if (!['PAYMENT_CONFIRMED', 'PAYMENT_RECEIVED'].includes(eventType)) {
      return NextResponse.json({ received: true, ignored: true });
    }
    const amountCents = Math.round(Number(payment?.value ?? 0) * 100);
    if (!Number.isSafeInteger(amountCents) || amountCents <= 0) {
      return NextResponse.json({ error: 'Valor inválido.' }, { status: 400 });
    }
    const eventId = String(payload.id || `${eventType}:${paymentId}`);
    const result = await reconcileAsaasPayment({
      eventId,
      eventType,
      paymentId,
      amountCents,
      receivedAt: String(payment?.paymentDate || payment?.confirmedDate || new Date().toISOString()),
      billingType: String(payment?.billingType || 'UNDEFINED'),
    });
    if (result === 'unknown') {
      // 200 evita reentregas infinitas de cobranças que não nasceram nesta aplicação.
      return NextResponse.json({ received: true, ignored: true });
    }
    return NextResponse.json({ received: true, duplicate: result === 'duplicate' });
  } catch (error) {
    console.error('[asaas-webhook] Falha ao conciliar:', error instanceof Error ? error.message : error);
    return NextResponse.json({ error: 'Falha ao processar webhook.' }, { status: 500 });
  }
}
