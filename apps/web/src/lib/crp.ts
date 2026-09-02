/**
 * Utilitários para formatação e validação de número de registro no CRP
 * (Conselho Regional de Psicologia) no padrão brasileiro (XX/YYYYY ou XX/YYYYYY).
 */

/**
 * Aplica máscara em tempo real para o campo de CRP:
 * - 2 dígitos para a região do Conselho (ex: 12, 06, 07)
 * - Barra separadora "/"
 * - Demais dígitos do registro profissional (até 7 dígitos)
 *
 * Exemplos:
 * - "12" -> "12"
 * - "123" -> "12/3"
 * - "1234567" -> "12/34567"
 * - "CRP 06/123456" -> "06/123456"
 */
export function maskCrpInput(value: string): string {
  const digits = value.replace(/\D/g, '').slice(0, 9);
  if (!digits) return '';
  if (digits.length <= 2) return digits;
  return `${digits.slice(0, 2)}/${digits.slice(2)}`;
}

/**
 * Normaliza o valor de CRP para o padrão XX/YYYY..., removendo prefixos de texto
 * desnecessários como "CRP " e garantindo a barra.
 */
export function normalizeCrp(value: unknown): string {
  const raw = String(value ?? '').trim();
  const digits = raw.replace(/\D/g, '');
  if (digits.length <= 2) return raw;
  return `${digits.slice(0, 2)}/${digits.slice(2, 9)}`;
}
