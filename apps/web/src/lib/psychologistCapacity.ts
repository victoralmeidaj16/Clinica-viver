export const LIMITE_PACIENTES_PADRAO = 5;
export const LIMITE_PACIENTES_MINIMO = 1;
export const LIMITE_PACIENTES_MAXIMO = 100;

export function limitePacientesValido(valor: unknown): valor is number {
  return (
    typeof valor === 'number' &&
    Number.isInteger(valor) &&
    valor >= LIMITE_PACIENTES_MINIMO &&
    valor <= LIMITE_PACIENTES_MAXIMO
  );
}

export function mensagemLimitePacientesInvalido(): string {
  return `O limite deve ser um número inteiro entre ${LIMITE_PACIENTES_MINIMO} e ${LIMITE_PACIENTES_MAXIMO}.`;
}
