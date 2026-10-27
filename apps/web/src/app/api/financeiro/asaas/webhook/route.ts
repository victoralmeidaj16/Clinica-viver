import { timingSafeEqual } from 'node:crypto';
import { NextResponse } from 'next/server';
import { reconcileAsaasPayment } from '@/server/payments/paymentLinkRepository';
import { reconcileConvenioInvoicePayment, reconcileConvenioInvoiceRefund } from '@/server/persistence/mysql/convenioRepository';

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
    if (['PAYMENT_REFUNDED', 'PAYMENT_PARTIALLY_REFUNDED'].includes(eventType)) {
      const refunds = Array.isArray(payment?.refunds) ? payment.refunds : [];
      const refundCents = refunds.reduce((sum: number, item: unknown) => {
        if (!item || typeof item !== 'object') return sum;
        const refund = item as Record<string, unknown>;
        return refund.status === 'DONE' ? sum + Math.round(Number(refund.value) * 100) : sum;
      }, 0);
      if ((!Number.isSafeInteger(refundCents) || refundCents <= 0) && String(payment?.externalReference ?? '').startsWith('VMPJ-')) {
        return NextResponse.json({ error: 'Estorno confirmado sem valor para conciliação.' }, { status: 503 });
      }
      const result = await reconcileConvenioInvoiceRefund({
        eventId: String(payload.id || `${eventType}:${paymentId}:${refundCents}`), eventType, paymentId,
        refundCents: Number.isSafeInteger(refundCents) ? refundCents : 0,
        receivedAt: new Date().toISOString(),
      });
      if (result === 'unknown' && String(payment?.externalReference ?? '').startsWith('VMPJ-')) {
        return NextResponse.json({ error: 'A fatura ainda não está pronta para conciliação.' }, { status: 503 });
      }
      return NextResponse.json({ received: true, duplicate: result === 'duplicate', ignored: result === 'unknown' });
    }
    if (!['PAYMENT_CONFIRMED', 'PAYMENT_RECEIVED'].includes(eventType)) {
      return NextResponse.json({ received: true, ignored: true });
    }
    const amountCents = Math.round(Number(payment?.value ?? 0) * 100);
    if (!Number.isSafeInteger(amountCents) || amountCents <= 0) {
      return NextResponse.json({ error: 'Valor inválido.' }, { status: 400 });
    }
    const eventId = String(payload.id || `${eventType}:${paymentId}`);
    let result = await reconcileAsaasPayment({
      eventId,
      eventType,
      paymentId,
      amountCents,
      receivedAt: String(payment?.paymentDate || payment?.confirmedDate || new Date().toISOString()),
      billingType: String(payment?.billingType || 'UNDEFINED'),
    });
    if (result === 'unknown') {
      result = await reconcileConvenioInvoicePayment({
        eventId, eventType, paymentId, amountCents,
        receivedAt: String(payment?.paymentDate || payment?.confirmedDate || new Date().toISOString()),
      });
    }
    if (result === 'unknown') {
      if (String(payment?.externalReference ?? '').startsWith('VMPJ-')) {
        return NextResponse.json({ error: 'A fatura ainda não está pronta para conciliação.' }, { status: 503 });
      }
      // 200 evita reentregas infinitas de cobranças que não nasceram nesta aplicação.
      return NextResponse.json({ received: true, ignored: true });
    }
    return NextResponse.json({ received: true, duplicate: result === 'duplicate' });
  } catch (error) {
    console.error('[asaas-webhook] Falha ao conciliar:', error instanceof Error ? error.message : error);
    return NextResponse.json({ error: 'Falha ao processar webhook.' }, { status: 500 });
  }
}
