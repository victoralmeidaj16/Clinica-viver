import 'server-only';
import PDFDocument from 'pdfkit';
import writeExcelFile from 'write-excel-file/node';
import type { EducationalCreditLine } from '@thats-life/core';
import { dataHoraSessao } from '@/lib/sessionReference';
import { clinicDateTimeToIso } from '@/lib/manualAppointment';

export function periodoCompetencia(mes: string) {
  if (!/^20\d\d-(0[1-9]|1[0-2])$/.test(mes)) throw new Error('Informe uma competência válida.');
  const proximo = new Date(Date.UTC(Number(mes.slice(0, 4)), Number(mes.slice(5)), 1)).toISOString().slice(0, 10);
  return {
    startDate: new Date(clinicDateTimeToIso(mes + '-01', '00:00')).toISOString(),
    endDate: new Date(Date.parse(clinicDateTimeToIso(proximo, '00:00')) - 1).toISOString(),
  };
}

export const origensCredito = { payment: 'Pagamento avulso', package: 'Pacote integral', company_session: 'Sessão empresarial', adjustment: 'Decisão da Gestão' };

export interface ApuracaoCredito {
  mes: string;
  linhas: Array<EducationalCreditLine & { profissional: string; origem: string }>;
  totalCentavos: number;
}

export async function arquivoApuracao(report: ApuracaoCredito, formato: 'pdf' | 'xlsx'): Promise<Buffer> {
  if (formato === 'xlsx') {
    return writeExcelFile([
      ['Competência', 'Profissional', 'Origem', 'Data', 'Referência', 'Base (R$)', 'Crédito (R$)', 'Justificativa', 'Referência do recebimento', 'Estorno', 'Crédito original', 'Autor', 'Comprovante'],
      ...report.linhas.map(l => [report.mes, l.profissional, l.origem, dataHoraSessao(l.occurredAt),
        l.chargeId, l.baseCents / 100, l.creditCents / 100, l.justification ?? '', l.receiptRef ?? '', l.eventRef ?? '', l.originalId ?? '', l.authorId ?? '', l.receiptUrl ?? '']),
      ['Total', '', '', '', '', null, report.totalCentavos / 100],
    ], { sheet: 'Créditos' }).toBuffer();
  }
  const doc = new PDFDocument({ size: 'A4', margin: 44 });
  const chunks: Buffer[] = [];
  const done = new Promise<Buffer>((resolve, reject) => {
    doc.on('data', chunk => chunks.push(chunk));
    doc.on('error', reject);
    doc.on('end', () => resolve(Buffer.concat(chunks)));
  });
  const money = (v: number) => (v / 100).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
  doc.fontSize(16).text('Créditos Educacionais');
  doc.fontSize(12).text('Competência ' + report.mes).moveDown();
  for (const l of report.linhas) {
    if (doc.y > 690) doc.addPage();
    doc.fontSize(11).text(l.profissional + ' · ' + l.origem);
    doc.fontSize(9).text(dataHoraSessao(l.occurredAt) + ' · ' + l.chargeId);
    doc.text('Base ' + money(l.baseCents) + '    Crédito ' + money(l.creditCents));
    if (l.receiptRef) doc.text('Referência do recebimento · ' + l.receiptRef);
    if (l.receiptUrl) doc.text('Abrir comprovante do recebimento', { link:l.receiptUrl, underline:true });
    if (l.justification) doc.text([l.justification,l.eventRef,l.originalId,l.authorId].filter(Boolean).join(' · '));
    doc.moveDown();
  }
  doc.fontSize(12).text('Total ' + money(report.totalCentavos));
  doc.end();
  return done;
}
