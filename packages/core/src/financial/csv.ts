import type {
  FinancialReportBundle,
  FinancialSummaryReport,
  SessionReceivable,
} from './types';

function escapeCsv(value: string | number): string {
  const text = String(value);
  return /[";\r\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

function centsToDecimal(value: number): string {
  return (value / 100).toFixed(2).replace('.', ',');
}

function row(values: readonly (string | number)[]): string {
  return values.map(escapeCsv).join(';');
}

function summaryRows(summary: FinancialSummaryReport): string[] {
  return [
    row(['Métrica', 'Valor']),
    row(['Cobranças', summary.chargeCount]),
    row(['Cobranças liquidadas', summary.settledChargeCount]),
    row(['Cobranças vencidas', summary.overdueChargeCount]),
    row(['Faturamento bruto', centsToDecimal(summary.grossBilledCents)]),
    row(['Descontos', centsToDecimal(summary.discountsCents)]),
    row(['Faturamento líquido', centsToDecimal(summary.netBilledCents)]),
    row(['Recebido', centsToDecimal(summary.receivedCents)]),
    row(['Estornos', centsToDecimal(summary.refundsCents)]),
    row(['Taxas', centsToDecimal(summary.feesCents)]),
    row(['Repasses pagos', centsToDecimal(summary.transfersPaidCents)]),
    row(['Caixa líquido', centsToDecimal(summary.netCashCents)]),
    row(['Em aberto', centsToDecimal(summary.outstandingCents)]),
    row(['Vencido', centsToDecimal(summary.overdueCents)]),
    row(['Inadimplência', (summary.delinquencyRate * 100).toFixed(2).replace('.', ',')]),
  ];
}

function receivableRows(receivables: readonly SessionReceivable[]): string[] {
  return [
    row([
      'Sessão',
      'Cobrança',
      'Paciente',
      'Profissional',
      'Vencimento',
      'Status',
      'Valor bruto',
      'Desconto',
      'Valor líquido',
      'Recebido',
      'Estornado',
      'Em aberto',
      'Taxas',
      'Repasse',
    ]),
    ...receivables.map((item) =>
      row([
        item.sessionId,
        item.chargeId,
        item.patientId,
        item.professionalId,
        item.dueAt,
        item.chargeStatus,
        centsToDecimal(item.grossAmountCents),
        centsToDecimal(item.discountAmountCents),
        centsToDecimal(item.netAmountCents),
        centsToDecimal(item.paidAmountCents),
        centsToDecimal(item.refundedAmountCents),
        centsToDecimal(item.outstandingAmountCents),
        centsToDecimal(item.feeAmountCents),
        centsToDecimal(item.transferAmountCents),
      ])
    ),
  ];
}

export function exportFinancialReportCsv(
  report: FinancialReportBundle
): string {
  return [
    '\uFEFFRELATÓRIO FINANCEIRO',
    ...summaryRows(report.summary),
    '',
    'CONTAS A RECEBER',
    ...receivableRows(report.receivables),
  ].join('\r\n');
}
