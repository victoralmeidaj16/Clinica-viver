export type SessionChargeDecision =
  | { create: true; amountCents: number }
  | { create: false; reason: 'company_funded' | 'missing_amount' };

/**
 * O que quem agenda precisa saber sobre a próxima sessão do paciente.
 * Com limite, quem paga cada sessão só se decide na realização, então a mesma
 * série pode ter sessões da empresa e sessões cobradas do paciente.
 */
export type CusteioAoAgendar = 'paciente' | 'empresa' | 'empresa_com_limite';

/** `custeadoEfetivo` vem de `custeioEfetivoSql`, a mesma regra que decide a cobrança. */
export function custeioAoAgendar(input: {
  custeadoEfetivo: unknown;
  cota: unknown;
}): CusteioAoAgendar {
  if (Number(input.custeadoEfetivo) !== 1) return 'paciente';
  return input.cota === null || input.cota === undefined ? 'empresa' : 'empresa_com_limite';
}

/** Regra pura que antecede qualquer INSERT financeiro. */
export function decideSessionCharge(input: {
  amountCents: unknown;
  companyFunded: boolean;
}): SessionChargeDecision {
  if (input.companyFunded) return { create: false, reason: 'company_funded' };
  const amountCents = Number(input.amountCents);
  if (!Number.isInteger(amountCents) || amountCents <= 0) {
    return { create: false, reason: 'missing_amount' };
  }
  return { create: true, amountCents };
}
