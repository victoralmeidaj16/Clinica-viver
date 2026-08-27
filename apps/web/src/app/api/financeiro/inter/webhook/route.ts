import { timingSafeEqual } from 'node:crypto';
import { NextResponse } from 'next/server';
import { reconcileInterPix } from '@/server/payments/paymentLinkRepository';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

interface InterPixEvent {
  endToEndId: string;
  txid: string;
  valor: string;
  horario: string;
}

function authorized(received: string | null, expected: string): boolean {
  if (!received) return false;
  const left = Buffer.from(received);
  const right = Buffer.from(expected);
  return left.length === right.length && timingSafeEqual(left, right);
}

export function parseInterPixEvents(payload: unknown): InterPixEvent[] {
  const record = payload && typeof payload === 'object' ? payload as Record<string, unknown> : {};
  const entries = Array.isArray(record.pix) ? record.pix : [];
  return entries.flatMap((entry) => {
    if (!entry || typeof entry !== 'object') return [];
    const pix = entry as Record<string, unknown>;
    const event = {
      endToEndId: String(pix.endToEndId ?? ''),
      txid: String(pix.txid ?? ''),
      valor: String(pix.valor ?? ''),
      horario: String(pix.horario ?? ''),
    };
    if (!event.endToEndId || !/^[A-Za-z0-9]{26,35}$/.test(event.txid)) return [];
    return [event];
  });
}

export async function POST(request: Request) {
  const expectedToken = process.env.INTER_WEBHOOK_TOKEN?.trim();
  if (!expectedToken) {
    console.error('[inter-webhook] INTER_WEBHOOK_TOKEN não configurado.');
    return NextResponse.json({ error: 'Webhook indisponível.' }, { status: 503 });
  }
  const receivedToken = new URL(request.url).searchParams.get('token')
    ?? request.headers.get('x-inter-webhook-token');
  if (!authorized(receivedToken, expectedToken)) {
    return NextResponse.json({ error: 'Não autorizado.' }, { status: 401 });
  }
  const expectedAccount = process.env.INTER_ACCOUNT_NUMBER?.replace(/\D/g, '').replace(/^0+/, '');
  const receivedAccount = request.headers.get('x-conta-corrente')?.replace(/\D/g, '').replace(/^0+/, '');
  if (expectedAccount && receivedAccount !== expectedAccount) {
    return NextResponse.json({ error: 'Conta corrente não autorizada.' }, { status: 401 });
  }

  try {
    const events = parseInterPixEvents(await request.json());
    if (events.length === 0) {
      return NextResponse.json({ error: 'Evento Pix inválido.' }, { status: 400 });
    }
    let processed = 0;
    let duplicates = 0;
    for (const event of events) {
      const amountCents = Math.round(Number(event.valor) * 100);
      if (!Number.isSafeInteger(amountCents) || amountCents <= 0) {
        return NextResponse.json({ error: 'Valor Pix inválido.' }, { status: 400 });
      }
      const receivedAt = new Date(event.horario);
      if (Number.isNaN(receivedAt.getTime())) {
        return NextResponse.json({ error: 'Horário Pix inválido.' }, { status: 400 });
      }
      const result = await reconcileInterPix({
        eventId: event.endToEndId,
        txid: event.txid,
        endToEndId: event.endToEndId,
        amountCents,
        receivedAt: receivedAt.toISOString(),
      });
      if (result === 'processed') processed += 1;
      if (result === 'duplicate') duplicates += 1;
      // Cobranças que não nasceram nesta instalação são ignoradas para evitar
      // reentregas infinitas do provedor.
    }
    return NextResponse.json({ received: true, processed, duplicates });
  } catch (error) {
    console.error('[inter-webhook] Falha ao conciliar:', error instanceof Error ? error.message : error);
    return NextResponse.json({ error: 'Falha ao processar webhook.' }, { status: 500 });
  }
}
