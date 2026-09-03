/**
 * Validação e formatação de CPF (Cadastro de Pessoas Físicas).
 *
 * Módulo puro, seguro tanto para execução no cliente (React) quanto no servidor (Node.js).
 */

const CPF_DIGITOS_REPETIDOS = /^(\d)\1{10}$/;

/**
 * Remove qualquer caractere não numérico e limita aos 11 dígitos do CPF.
 */
export function cleanCpf(value: unknown): string {
  return String(value ?? '').replace(/\D/g, '').slice(0, 11);
}

/**
 * Aplica a máscara canônica `000.000.000-00`.
 */
export function maskCpf(value: unknown): string {
  const digits = cleanCpf(value);
  return digits
    .replace(/(\d{3})(\d)/, '$1.$2')
    .replace(/(\d{3})(\d)/, '$1.$2')
    .replace(/(\d{3})(\d{1,2})$/, '$1-$2');
}

/**
 * Valida se a sequência fornecida corresponde a um CPF matematicamente válido.
 *
 * Critérios:
 * 1. Deve conter exatamente 11 dígitos numéricos após a limpeza.
 * 2. Não pode ter todos os dígitos iguais (ex: 000.000.000-00, 111.111.111-11).
 * 3. Deve satisfazer os dois dígitos verificadores segundo o algoritmo oficial de módulo 11.
 */
export function validCpf(value: unknown): boolean {
  const cpf = cleanCpf(value);
  if (cpf.length !== 11 || CPF_DIGITOS_REPETIDOS.test(cpf)) {
    return false;
  }

  // Primeiro dígito verificador (pesos 10 a 2)
  let soma1 = 0;
  for (let i = 0; i < 9; i++) {
    soma1 += Number(cpf[i]) * (10 - i);
  }
  let resto1 = (soma1 * 10) % 11;
  if (resto1 === 10 || resto1 === 11) resto1 = 0;
  if (resto1 !== Number(cpf[9])) return false;

  // Segundo dígito verificador (pesos 11 a 2)
  let soma2 = 0;
  for (let i = 0; i < 10; i++) {
    soma2 += Number(cpf[i]) * (11 - i);
  }
  let resto2 = (soma2 * 10) % 11;
  if (resto2 === 10 || resto2 === 11) resto2 = 0;
  if (resto2 !== Number(cpf[10])) return false;

  return true;
}
