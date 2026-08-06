import 'server-only';

/**
 * Trava de destinatários do WhatsApp.
 *
 * Enquanto a operação está em piloto, mensagem só pode sair para os números
 * explicitamente autorizados — hoje, um contato de paciente e um de
 * profissional. Todo o resto é bloqueado.
 *
 * Três decisões que valem mais que o código:
 *
 *   1. **Falha fechada.** Lista vazia bloqueia tudo. O modo perigoso não pode
 *      ser o modo padrão: esquecer de configurar precisa resultar em nenhuma
 *      mensagem, não em todas.
 *   2. **A trava é do servidor.** Ela não confia em quem chama nem em preferência
 *      de paciente. Qualquer caminho que um dia envie WhatsApp passa por aqui.
 *   3. **Bloqueio não é falha silenciosa.** Ele é registrado e devolvido como
 *      recusa explícita, para que a fila não marque como entregue o que nunca
 *      saiu.
 *
 * Mensagem enviada é irreversível. Um número de teste digitado errado é o
 * telefone de um desconhecido recebendo conteúdo de uma clínica de psicologia.
 */

export class RecipientNotAllowedError extends Error {
  constructor() {
    // Sem o número na mensagem: ela vai para log, e log não é lugar de contato
    // de paciente.
    super('Destinatário fora da lista autorizada para envio de WhatsApp.');
    this.name = 'RecipientNotAllowedError';
  }
}

/**
 * Reduz o número à sua forma comparável: só dígitos, com o país explícito.
 *
 * O Brasil é o caso chato. `(48) 99685-6641`, `+55 48 99685-6641` e
 * `554896856641` são a mesma pessoa, e o WhatsApp historicamente descarta o
 * nono dígito em números antigos de algumas regiões. Comparar texto cru faria
 * a trava deixar passar — ou barrar — pelo motivo errado.
 */
export function normalizeWhatsAppNumber(value: string): string {
  const digits = value.replace(/\D/g, '');
  if (!digits) return '';

  // Sem código de país, assume Brasil: é a operação inteira desta clínica.
  const withCountry = digits.length <= 11 ? `55${digits}` : digits;

  // 55 + DDD + 9 dígitos → também compara sem o nono dígito.
  return withCountry;
}

/** Formas equivalentes do mesmo número, para comparação tolerante. */
function variants(value: string): Set<string> {
  const normalized = normalizeWhatsAppNumber(value);
  const forms = new Set<string>();
  if (!normalized) return forms;

  forms.add(normalized);

  const country = normalized.slice(0, 2);
  const rest = normalized.slice(2);
  if (country === '55' && rest.length === 11 && rest[2] === '9') {
    // 48 9 9685-6641 → 48 9685-6641
    forms.add(`55${rest.slice(0, 2)}${rest.slice(3)}`);
  }
  if (country === '55' && rest.length === 10) {
    // 48 9685-6641 → 48 9 9685-6641
    forms.add(`55${rest.slice(0, 2)}9${rest.slice(2)}`);
  }

  return forms;
}

/**
 * Números autorizados, de `WHATSAPP_ALLOWED_NUMBERS` (separados por vírgula).
 * Sem a variável, ninguém está autorizado.
 */
export function allowedWhatsAppNumbers(): readonly string[] {
  return (process.env.WHATSAPP_ALLOWED_NUMBERS ?? '')
    .split(',')
    .map((entry) => normalizeWhatsAppNumber(entry))
    .filter(Boolean);
}

export function isWhatsAppRecipientAllowed(value: string): boolean {
  const allowed = allowedWhatsAppNumbers();
  if (allowed.length === 0) return false;

  const candidates = variants(value);
  return allowed.some((entry) => [...variants(entry)].some((form) => candidates.has(form)));
}

/** Lança quando o destinatário não está autorizado. */
export function assertWhatsAppRecipientAllowed(value: string): void {
  if (!isWhatsAppRecipientAllowed(value)) throw new RecipientNotAllowedError();
}
