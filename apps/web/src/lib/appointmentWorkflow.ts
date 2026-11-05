const STATUS_ABERTO = new Set(['agendado', 'confirmado']);

/**
 * O botão nasce somente quando a sessão terminou e ainda espera desfecho.
 *
 * `semSessaoClinica` cobre o passivo deixado pela sincronização automática que
 * trocava o status durante a listagem: o atendimento ficou gravado como
 * realizado, mas sem a sessão clínica que alimenta indicadores e faturamento.
 * Enquanto esse registro não existir, a confirmação ainda tem o que fazer.
 */
export function podeConfirmarRealizacao(
  status: string,
  fim: string | Date,
  agora: Date = new Date(),
  semSessaoClinica = false
): boolean {
  const fimEm = fim instanceof Date ? fim.getTime() : Date.parse(fim);
  if (!Number.isFinite(fimEm) || fimEm > agora.getTime()) return false;
  if (STATUS_ABERTO.has(status)) return true;
  return status === 'realizado' && semSessaoClinica;
}

/** A falta vale a partir do início: quem não chegou não precisa esperar o fim previsto. */
export function podeRegistrarFalta(status: string, inicio: string, agora: number): boolean {
  const inicioEm = Date.parse(inicio);
  return STATUS_ABERTO.has(status) && Number.isFinite(inicioEm) && inicioEm <= agora;
}

export function possuiPagamento(pagamentoStatus?: string): boolean {
  return ['paid', 'partially_paid', 'refunded'].includes(pagamentoStatus ?? '');
}

/** A decisão de isenção é a ausência de cobrança ativa: cancelar é o que a aplica. */
export function faltaCobrada(pagamentoStatus?: string): boolean {
  return Boolean(pagamentoStatus) && pagamentoStatus !== 'cancelled';
}
