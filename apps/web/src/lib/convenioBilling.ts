/** NULL herda a política do convênio; zero e um são exceções explícitas. */
export function resolveCusteio(patientOverride: unknown, convenioDefault: unknown): boolean {
  return patientOverride === null || patientOverride === undefined
    ? Boolean(convenioDefault)
    : Boolean(patientOverride);
}

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
