/**
 * Prazo para o psicólogo responder a uma oferta de atendimento (especificação
 * final, 5.02): começa em 24 horas e a Gestão pode alterá-lo.
 *
 * O valor configurado vale para as **novas** ofertas. Cada oferta grava o prazo
 * com que nasceu (`prazoRespostaHoras` no lead): mudar a configuração não
 * encurta nem estende o relógio de quem já recebeu, nem faz uma oferta em
 * andamento vencer de repente.
 */

export const PRAZO_OFERTA_PADRAO_HORAS = 24;
export const PRAZO_OFERTA_MINIMO_HORAS = 1;
/** Uma semana. Mais do que isso deixa o paciente sem resposta tempo demais. */
export const PRAZO_OFERTA_MAXIMO_HORAS = 168;

/** Inteiro dentro dos limites, ou `null` para qualquer outra coisa. */
export function prazoOfertaValido(valor: unknown): number | null {
  const numero = typeof valor === 'string' && valor.trim() ? Number(valor) : valor;
  if (typeof numero !== 'number' || !Number.isInteger(numero)) return null;
  if (numero < PRAZO_OFERTA_MINIMO_HORAS || numero > PRAZO_OFERTA_MAXIMO_HORAS) return null;
  return numero;
}

/** Valor efetivo: o configurado quando válido, senão o padrão de 24 horas. */
export function normalizarPrazoOferta(valor: unknown): number {
  return prazoOfertaValido(valor) ?? PRAZO_OFERTA_PADRAO_HORAS;
}

/** Prazo da oferta em andamento. Ofertas gravadas antes da configuração valem 24 horas. */
export function prazoDaOferta(lead: { prazoRespostaHoras?: number | null }): number {
  return normalizarPrazoOferta(lead.prazoRespostaHoras);
}

/** Momento em que a oferta vence, ou `undefined` quando não há oferta. */
export function expiracaoDaOferta(
  lead: { alocadoEm?: string; prazoRespostaHoras?: number | null },
): string | undefined {
  const inicio = lead.alocadoEm ? Date.parse(lead.alocadoEm) : Number.NaN;
  if (!Number.isFinite(inicio)) return undefined;
  return new Date(inicio + prazoDaOferta(lead) * 3_600_000).toISOString();
}

/**
 * Prazo por extenso. Acima de um dia, mostra também em dias — "48 horas" é
 * fácil de ler errado numa tela cheia; "48 horas (2 dias)" não.
 */
export function rotuloPrazo(horas: number): string {
  const base = `${horas} ${horas === 1 ? 'hora' : 'horas'}`;
  if (horas <= 24) return base;
  const dias = Math.floor(horas / 24);
  const resto = horas % 24;
  const emDias = `${dias} ${dias === 1 ? 'dia' : 'dias'}`;
  return resto ? `${base} (${emDias} e ${resto} ${resto === 1 ? 'hora' : 'horas'})` : `${base} (${emDias})`;
}
