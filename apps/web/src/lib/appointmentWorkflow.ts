const STATUS_ABERTO = new Set(['agendado', 'confirmado']);

/** O botão nasce somente quando a sessão terminou e ainda espera desfecho. */
export function podeConfirmarRealizacao(
  status: string,
  fim: string | Date,
  agora: Date = new Date()
): boolean {
  const fimEm = fim instanceof Date ? fim.getTime() : Date.parse(fim);
  return STATUS_ABERTO.has(status) && Number.isFinite(fimEm) && fimEm <= agora.getTime();
}

