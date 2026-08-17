const FUSO_FISCAL_PADRAO = 'America/Sao_Paulo';

/**
 * Data de competência da NFS-e no fuso da prestação.
 *
 * Instantes de sessão são persistidos em UTC. Cortar a string ISO em dez
 * caracteres faria uma sessão noturna próxima da meia-noite cair no dia
 * fiscal seguinte. A NFS-e precisa da data local em que o atendimento ocorreu.
 */
export function competenciaNfseDoAtendimento(
  inicioDoAtendimento: string,
  fuso = FUSO_FISCAL_PADRAO
): string {
  const instante = new Date(inicioDoAtendimento);
  if (Number.isNaN(instante.getTime())) {
    throw new Error('O início do atendimento deve ser uma data ISO válida.');
  }

  const partes = new Intl.DateTimeFormat('en-CA', {
    timeZone: fuso,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(instante);
  const parte = (tipo: Intl.DateTimeFormatPartTypes) =>
    partes.find((item) => item.type === tipo)?.value;

  return `${parte('year')}-${parte('month')}-${parte('day')}`;
}
