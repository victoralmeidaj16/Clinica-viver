import type { FinancialReportBundle } from './types';

function formatMoney(cents: number): string {
  const absolute = Math.abs(cents);
  const integer = Math.floor(absolute / 100)
    .toString()
    .replace(/\B(?=(\d{3})+(?!\d))/g, '.');
  const decimal = (absolute % 100).toString().padStart(2, '0');
  return `${cents < 0 ? '-' : ''}R$ ${integer},${decimal}`;
}

function formatDate(value?: string, includeTime = false): string {
  if (!value) return '-';
  const date = new Date(value);
  const day = date.getUTCDate().toString().padStart(2, '0');
  const month = (date.getUTCMonth() + 1).toString().padStart(2, '0');
  const year = date.getUTCFullYear();
  if (!includeTime) return `${day}/${month}/${year}`;
  const hours = date.getUTCHours().toString().padStart(2, '0');
  const minutes = date.getUTCMinutes().toString().padStart(2, '0');
  return `${day}/${month}/${year} ${hours}:${minutes} UTC`;
}

function formatStatus(status: string): string {
  const labels: Record<string, string> = {
    paid: 'paga',
    overdue: 'vencida',
    pending: 'pendente',
    partially_paid: 'parcial',
    refunded: 'estornada',
    cancelled: 'cancelada',
  };
  return labels[status] ?? status;
}

function escapePdfText(value: string): string {
  return Array.from(value.normalize('NFC'))
    .map((character) => {
      const code = character.charCodeAt(0);
      if (character === '\\' || character === '(' || character === ')') {
        return `\\${character}`;
      }
      if (code >= 32 && code <= 126) return character;
      if (code <= 255) return `\\${code.toString(8).padStart(3, '0')}`;
      return '?';
    })
    .join('');
}

function truncate(value: string, length: number): string {
  return value.length <= length ? value : `${value.slice(0, length - 3)}...`;
}

function buildReportLines(report: FinancialReportBundle): string[] {
  const { summary } = report;
  return [
    `Gerado em: ${formatDate(summary.generatedAt, true)}`,
    `Período: ${summary.period.startDate ? formatDate(summary.period.startDate) : 'início'} a ${summary.period.endDate ? formatDate(summary.period.endDate) : 'hoje'}`,
    '',
    'RESUMO',
    `Cobranças: ${summary.chargeCount} | Liquidadas: ${summary.settledChargeCount} | Vencidas: ${summary.overdueChargeCount}`,
    `Faturamento bruto: ${formatMoney(summary.grossBilledCents)}`,
    `Descontos: ${formatMoney(summary.discountsCents)}`,
    `Faturamento líquido: ${formatMoney(summary.netBilledCents)}`,
    `Recebido: ${formatMoney(summary.receivedCents)}`,
    `Estornos: ${formatMoney(summary.refundsCents)} | Taxas: ${formatMoney(summary.feesCents)}`,
    `Repasses pagos: ${formatMoney(summary.transfersPaidCents)}`,
    `Caixa líquido: ${formatMoney(summary.netCashCents)}`,
    `Em aberto: ${formatMoney(summary.outstandingCents)} | Vencido: ${formatMoney(summary.overdueCents)}`,
    `Inadimplência: ${(summary.delinquencyRate * 100).toFixed(2)}%`,
    '',
    'CONTAS A RECEBER',
    'Sessão             Vencimento   Status          Líquido        Recebido       Em aberto',
    ...report.receivables.map(
      (item) =>
        `${truncate(item.sessionId, 18).padEnd(19)} ` +
        `${formatDate(item.dueAt).padEnd(12)} ` +
        `${formatStatus(item.chargeStatus).padEnd(15)} ` +
        `${formatMoney(item.netAmountCents).padStart(13)} ` +
        `${formatMoney(item.paidAmountCents).padStart(13)} ` +
        `${formatMoney(item.outstandingAmountCents).padStart(13)}`
    ),
    '',
    'Documento gerencial. Valores monetários calculados em centavos inteiros.',
  ];
}

function paginate(lines: readonly string[], pageSize = 46): string[][] {
  const pages: string[][] = [];
  for (let index = 0; index < lines.length; index += pageSize) {
    pages.push(lines.slice(index, index + pageSize));
  }
  return pages.length > 0 ? pages : [[]];
}

function buildContentStream(
  lines: readonly string[],
  pageNumber: number,
  pageCount: number
): string {
  const body = lines
    .map((line) => `(${escapePdfText(line)}) Tj\nT*`)
    .join('\n');
  return [
    'BT',
    '/F1 9 Tf',
    '48 800 Td',
    '14 TL',
    `(${escapePdfText('RELATÓRIO FINANCEIRO - THATS LIFE')}) Tj`,
    'T*',
    'T*',
    body,
    'ET',
    'BT',
    '/F1 8 Tf',
    '260 25 Td',
    `(${escapePdfText(`Página ${pageNumber} de ${pageCount}`)}) Tj`,
    'ET',
  ].join('\n');
}

function encodeAscii(value: string): Uint8Array {
  return new TextEncoder().encode(value);
}

export function exportFinancialReportPdf(
  report: FinancialReportBundle
): Uint8Array {
  const pages = paginate(buildReportLines(report));
  const objects: string[] = [];
  const pageReferences = pages.map((_, index) => `${4 + index * 2} 0 R`);

  objects.push('<< /Type /Catalog /Pages 2 0 R >>');
  objects.push(
    `<< /Type /Pages /Kids [${pageReferences.join(' ')}] /Count ${pages.length} >>`
  );
  objects.push(
    '<< /Type /Font /Subtype /Type1 /BaseFont /Courier /Encoding /WinAnsiEncoding >>'
  );

  pages.forEach((pageLines, index) => {
    const pageObjectNumber = 4 + index * 2;
    const contentObjectNumber = pageObjectNumber + 1;
    const stream = buildContentStream(pageLines, index + 1, pages.length);
    const streamLength = encodeAscii(stream).length;
    objects.push(
      `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Resources << /Font << /F1 3 0 R >> >> /Contents ${contentObjectNumber} 0 R >>`
    );
    objects.push(`<< /Length ${streamLength} >>\nstream\n${stream}\nendstream`);
  });

  let pdf = '%PDF-1.4\n%\xE2\xE3\xCF\xD3\n';
  const offsets = [0];
  objects.forEach((object, index) => {
    offsets.push(encodeAscii(pdf).length);
    pdf += `${index + 1} 0 obj\n${object}\nendobj\n`;
  });
  const xrefOffset = encodeAscii(pdf).length;
  pdf += `xref\n0 ${objects.length + 1}\n`;
  pdf += '0000000000 65535 f \n';
  for (const offset of offsets.slice(1)) {
    pdf += `${offset.toString().padStart(10, '0')} 00000 n \n`;
  }
  pdf += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\n`;
  pdf += `startxref\n${xrefOffset}\n%%EOF\n`;
  return encodeAscii(pdf);
}
