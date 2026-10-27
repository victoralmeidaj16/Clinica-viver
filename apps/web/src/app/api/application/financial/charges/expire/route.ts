import { processPendingChargeDueResets } from '@/server/payments/sessionChargeDueWorker';
import { timingSafeEqual } from 'node:crypto';
import { NextResponse } from 'next/server';
import { expirarCobrancasPendentes } from '@/server/payments/sessionCharge';
import { recuperarCobrancasPosSessaoPendentes } from '@/server/payments/sessionChargeRecovery';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

function authorized(request: Request): boolean {
  const expected = process.env.BILLING_EXPIRY_TOKEN?.trim();
  const received = request.headers.get('x-billing-expiry-token')?.trim();
  if (!expected || !received) return false;
  const left = Buffer.from(expected); const right = Buffer.from(received);
  return left.length === right.length && timingSafeEqual(left, right);
}

export async function POST(request: Request) {
  if (!authorized(request)) return NextResponse.json({ error: 'Não autorizado.' }, { status: 401 });
  try {
    const [dueResets, postSessionCharges, expiry] = await Promise.all([
      processPendingChargeDueResets(),
      recuperarCobrancasPosSessaoPendentes(),
      expirarCobrancasPendentes(),
    ]);
    return NextResponse.json({ success: true, dueResets, postSessionCharges, ...expiry });
  } catch (error) {
    console.error('[financeiro] Falha na varredura de vencimentos:', error);
    return NextResponse.json({ error: 'Falha ao expirar cobranças.' }, { status: 500 });
  }
}
