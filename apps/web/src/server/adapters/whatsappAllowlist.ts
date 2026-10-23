import 'server-only';

/**
 * Validação de destinatários do WhatsApp.
 *
 * O piloto com lista fechada de números (`WHATSAPP_ALLOWED_NUMBERS`) acabou:
 * qualquer número brasileiro plausível recebe. O que continua barrado é
 * telefone vazio ou truncado, que não deve chegar ao provedor — ele tentaria
 * entregar para quem quer que responda.
 *
 * Bloqueio não é falha silenciosa: é registrado e devolvido como recusa
 * explícita, para que a fila não marque como entregue o que nunca saiu.
 */

export class RecipientNotAllowedError extends Error {
  constructor() {
    // Sem o número na mensagem: ela vai para log, e log não é lugar de contato
    // de paciente.
    super('Telefone inválido para envio de WhatsApp.');
    this.name = 'RecipientNotAllowedError';
  }
}

/**
 * Reduz o número à sua forma comparável: só dígitos, com o país explícito.
 * Sem código de país, assume Brasil: é a operação inteira desta clínica.
 */
export function normalizeWhatsAppNumber(value: string): string {
  const digits = value.replace(/\D/g, '');
  if (!digits) return '';
  return digits.length <= 11 ? `55${digits}` : digits;
}

/** Número brasileiro plausível: 55 + DDD + 8 ou 9 dígitos. */
export function isWhatsAppRecipientAllowed(value: string): boolean {
  return /^55[1-9][0-9]\d{8,9}$/.test(normalizeWhatsAppNumber(value));
}

/** Lança quando o telefone não é um número brasileiro plausível. */
export function assertWhatsAppRecipientAllowed(value: string): void {
  if (!isWhatsAppRecipientAllowed(value)) throw new RecipientNotAllowedError();
}
