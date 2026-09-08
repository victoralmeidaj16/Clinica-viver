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
