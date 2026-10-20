export type FinancialAttendanceStatus = 'a_confirmar' | 'realizado' | 'cancelado';

/**
 * O financeiro reflete a confirmação explícita do psicólogo. Horário passado
 * e pagamento conciliado não comprovam que o atendimento ocorreu.
 */
export function financialAttendanceStatus(status: unknown): FinancialAttendanceStatus {
  if (status === 'realizado' || status === 'completed') return 'realizado';
  if (status === 'cancelado' || status === 'cancelled') return 'cancelado';
  return 'a_confirmar';
}
