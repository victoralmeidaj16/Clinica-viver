import { NextResponse } from 'next/server';
import { getPublicPaymentProfile } from '@/server/payments/paymentLinkRepository';

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
  const profile = await getPublicPaymentProfile(token);
  if (!profile) return NextResponse.json({ error: 'Link de pagamento inválido.' }, { status: 404 });
  return NextResponse.json({
    professionalName: profile.professionalName,
    modalities: {
      social: profile.socialCents,
      particular: profile.privateCents,
    },
  }, { headers: { 'Cache-Control': 'private, no-store' } });
}
