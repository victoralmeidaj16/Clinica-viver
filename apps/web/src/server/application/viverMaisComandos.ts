import 'server-only';

/**
 * As duas palavras que o psicólogo responde no WhatsApp depois de receber um
 * paciente. Ficam num módulo próprio porque são usadas nas duas pontas — o
 * texto que instrui e o interpretador que lê a resposta — e uma divergência
 * entre elas produziria o pior defeito possível: a mensagem ensinando uma
 * palavra que o sistema não reconhece.
 */
export const COMANDO_CONTATO = 'CONTATO';
export const COMANDO_ENCAMINHAR = 'ENCAMINHAR';

export type ComandoPsicologo = 'CONTATO' | 'ENCAMINHAR' | null;

/**
 * Lê a resposta com a tolerância que o WhatsApp exige.
 *
 * Acento, caixa, pontuação e um "ok, contato feito" ao redor da palavra não
 * podem custar um SLA. O que não se aceita é adivinhar: texto sem nenhuma das
 * duas palavras devolve `null`, e quem chama responde com a instrução em vez de
 * escolher por conta própria entre confirmar e devolver o paciente.
 */
export function interpretarComando(texto: string): ComandoPsicologo {
  const limpo = texto
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toUpperCase()
    .replace(/[^A-Z\s]/g, ' ');

  const palavras = new Set(limpo.split(/\s+/).filter(Boolean));
  const temEncaminhar = palavras.has('ENCAMINHAR') || palavras.has('ENCAMINHA');
  const temContato = palavras.has('CONTATO') || palavras.has('CONTATEI');

  // Mensagem com as duas palavras é ambígua ("fiz contato, pode encaminhar?").
  // Nenhuma das duas ações é reversível de graça, então a resposta é pedir
  // clareza, não sortear uma.
  if (temEncaminhar && temContato) return null;
  if (temEncaminhar) return 'ENCAMINHAR';
  if (temContato) return 'CONTATO';
  return null;
}
