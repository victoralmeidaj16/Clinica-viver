/** Rateio inteiro e determinístico; a última linha absorve o resto ao centavo. */
export function ratearFatura(valorRecebidoCents: number, valoresCents: readonly number[]): number[] {
  if (!Number.isSafeInteger(valorRecebidoCents) || valorRecebidoCents < 0) throw new Error('Valor recebido inválido.');
  const total = valoresCents.reduce((soma, valor) => soma + valor, 0);
  if (!Number.isSafeInteger(total) || total <= 0 || valoresCents.some((valor) => !Number.isSafeInteger(valor) || valor <= 0)) {
    throw new Error('A fatura não possui valores válidos para rateio.');
  }
  let distribuido = 0;
  return valoresCents.map((valor, indice) => {
    const parte = indice === valoresCents.length - 1
      ? valorRecebidoCents - distribuido
      : Math.floor((valorRecebidoCents * valor) / total);
    distribuido += parte;
    return parte;
  });
}

/**
 * Ciclo da cota de sessões custeadas: total do vínculo ou renovada a cada mês.
 *
 * As duas formas existem porque os acordos das empresas parceiras vêm nas duas
 * — "pagamos dez sessões" e "pagamos quatro por mês" — e tratar a segunda como
 * a primeira faria o benefício acabar no terceiro mês.
 */
export type CusteioCiclo = 'total' | 'mensal';

/** Resumo curto do acordo financeiro para os cartões de pacientes. */
export function resumoCusteio(input: {
  custeioConfigurado?: boolean;
  custeioCota?: number;
  custeioCiclo?: CusteioCiclo;
}): string | undefined {
  if (Number.isInteger(input.custeioCota) && (input.custeioCota ?? 0) > 0) {
    const quantidade = input.custeioCota === 1 ? '1 sessão' : `${input.custeioCota} sessões`;
    return input.custeioCiclo === 'mensal'
      ? `${quantidade}/mês pagas pela empresa`
      : `${quantidade} pagas pela empresa`;
  }
  if (input.custeioConfigurado === true) return 'Sessões pagas pela empresa';
  if (input.custeioConfigurado === false) return 'Sessões pagas pelo paciente';
  return undefined;
}

export function normalizarCicloCusteio(valor: unknown): CusteioCiclo | null {
  return valor === 'mensal' ? 'mensal' : valor === 'total' ? 'total' : null;
}

/**
 * A sessão foi quitada pela empresa, não pelo paciente.
 *
 * Qualquer um dos três sinais basta, e eles não são redundantes: o vínculo do
 * paciente é o que a clínica combinou, a fatura é o que de fato agrupou a
 * cobrança, e o boleto é como essa fatura foi paga — no fluxo do convênio, é o
 * único jeito. Um vínculo desfeito depois do atendimento apaga o primeiro sinal
 * sem apagar o que aconteceu, e era por isso que sessões pagas por boleto
 * continuavam oferecendo emissão individual.
 *
 * Quem paga decide o tomador da nota, então isto vale tanto para o botão da
 * tabela quanto para a rota de emissão.
 */
export function quitadaPelaEmpresa(input: {
  custeadoPelaEmpresa?: boolean;
  faturaConvenioId?: string;
  paymentMethod?: string;
}): boolean {
  return Boolean(input.custeadoPelaEmpresa)
    || Boolean(input.faturaConvenioId)
    || input.paymentMethod === 'boleto';
}
