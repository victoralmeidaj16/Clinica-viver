import { NextResponse } from 'next/server';
import { createPsychologistPasswordReset } from '@/server/application/passwordReset';
import { exigirGestao, NaoAutorizadoError } from '@/server/viverMaisGestaoAuth';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(request: Request) {
  try {
    await exigirGestao();
    const body = await request.json() as { email?: unknown };
    const reset = await createPsychologistPasswordReset(String(body.email ?? ''));
    const appUrl = process.env.NEXT_PUBLIC_APP_URL?.trim().replace(/\/$/, '') || 'https://clinicavivermais.cloud';
    const url = `${appUrl}/redefinir-senha?token=${encodeURIComponent(reset.token)}`;
    return NextResponse.json({ success: true, data: { url, expiresAt: reset.expiresAt } });
  } catch (error) {
    const status = error instanceof NaoAutorizadoError ? error.status : 400;
    const message = error instanceof Error ? error.message : 'Não foi possível gerar o link.';
    return NextResponse.json({ success: false, error: message }, { status });
  }
}
