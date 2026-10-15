import 'server-only';

import { createHash } from 'node:crypto';
import { montarEmailViverMais } from './viverMaisEmailTemplate';

export function passwordResetEmailConfigured(): boolean {
  return Boolean(process.env.RESEND_API_KEY?.trim());
}

export async function sendPasswordResetEmail(email: string, token: string): Promise<void> {
  const origin = process.env.NEXT_PUBLIC_APP_URL?.trim() || 'https://clinicavivermais.cloud';
  const url = new URL('/redefinir-senha', origin);
  url.searchParams.set('token', token);
  const href = url.href.replace(/&/g, '&amp;').replace(/"/g, '&quot;');
  const response = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${process.env.RESEND_API_KEY?.trim()}`,
      'Content-Type': 'application/json',
      'Idempotency-Key': `password-reset-${createHash('sha256').update(token).digest('hex')}`,
    },
    body: JSON.stringify({
      from: process.env.PSYCHOLOGIST_EMAIL_FROM?.trim() || process.env.RESEND_FROM?.trim()
        || process.env.EMAIL_FROM?.trim() || 'Viver Mais Psicologia <atendimento@clinicavivermais.cloud>',
      to: [email],
      subject: 'Redefina sua senha — Viver Mais Psicologia',
      text: `Para definir uma nova senha, acesse: ${url.href}\n\nEste link é individual, de uso único e expira em duas horas. Se você não pediu a troca, ignore este e-mail. Sua senha continuará a mesma.`,
      html: montarEmailViverMais({
        preheader: 'Recupere seu acesso ao portal Viver Mais.',
        eyebrow: 'Recuperação de acesso',
        titulo: 'Redefina sua senha',
        saudacao: 'Olá!',
        paragrafos: ['Recebemos uma solicitação para redefinir sua senha de acesso ao portal.',
          'Clique no botão abaixo para escolher uma nova senha. O link vale por duas horas e pode ser usado uma única vez.'],
        acaoPrincipal: { label: 'Redefinir minha senha', href },
        aviso: 'Se você não fez esta solicitação, ignore este e-mail. Sua senha continuará a mesma. Nunca compartilhe este link.',
      }),
    }),
    signal: AbortSignal.timeout(10_000),
  });
  if (!response.ok) throw new Error(`PASSWORD_RESET_EMAIL_HTTP_${response.status}`);
}
