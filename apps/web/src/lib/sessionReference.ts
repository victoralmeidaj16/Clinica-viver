export const FUSO_CLINICA = 'America/Sao_Paulo';

export function dataHoraSessao(value: string | Date): string {
  const date = value instanceof Date ? value : new Date(value);
  if (!Number.isFinite(date.getTime())) throw new Error('Data da sessão inválida.');

  const parts = new Intl.DateTimeFormat('pt-BR', {
    timeZone: FUSO_CLINICA,
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(date);
  const part = (type: Intl.DateTimeFormatPartTypes) =>
    parts.find((item) => item.type === type)?.value;

  return `${part('day')}/${part('month')}/${part('year')} às ${part('hour')}:${part('minute')}`;
}

/** Texto compartilhado pela cobrança, pela prévia e pelo XML da NFS-e. */
export function descricaoFiscalDaSessao(value: string | Date): string {
  return `Atendimento Psicoterápico — sessão em ${dataHoraSessao(value)}.`;
}
