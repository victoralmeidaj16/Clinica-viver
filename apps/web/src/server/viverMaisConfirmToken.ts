import 'server-only';

import { createHmac, timingSafeEqual } from 'node:crypto';

/**
 * Token do link de confirmação de contato.
 *
 * O psicólogo recebe o link no WhatsApp e clica dele — sem sessão, muitas vezes
 * de outro aparelho. Então o link precisa provar sozinho quem ele autoriza.
 *
 * É deliberadamente **separado do token de sessão** (`server/auth.ts`), com
 * segredo próprio quando configurado. Um link que circula por aplicativo de
 * mensagens, fica em histórico de conversa e pode ser encaminhado não deve, em
 * hipótese alguma, ser material para forjar uma sessão autenticada. O que este
 * token autoriza é uma única coisa: dizer "já falei com esta pessoa".
 *
 * Ele não expira. O prazo do SLA já resolve isso do lado certo: passadas as
 * 24h o lead vai para outro profissional, e confirmar depois disso não devolve
 * o paciente a quem perdeu o prazo.
 */

function secret(): string {
  return (
    process.env.SLA_CONFIRM_SECRET?.trim() ||
    process.env.AUTH_SESSION_SECRET?.trim() ||
    'dev-only-change-this-confirm-secret'
  );
}

function safeEqual(left: string, right: string): boolean {
  const a = Buffer.from(left);
  const b = Buffer.from(right);
  return a.length === b.length && timingSafeEqual(a, b);
}

/**
 * Assina o par lead + psicólogo.
 *
 * Os dois entram na assinatura porque o token precisa dizer *quem* confirma,
 * não só *o quê*: com o lead sozinho, o link vazado de um transbordo serviria
 * para o profissional anterior confirmar um contato que já não é dele.
 */
export function gerarTokenConfirmacao(leadId: string, psicologoId: string): string {
  return createHmac('sha256', secret()).update(`${leadId}:${psicologoId}`).digest('base64url');
}

export function validarTokenConfirmacao(
  leadId: string,
  psicologoId: string,
  token: string | null | undefined
): boolean {
  if (!token) return false;
  return safeEqual(token, gerarTokenConfirmacao(leadId, psicologoId));
}
