import 'server-only';

import PDFDocument from 'pdfkit';
import type { Convenio, SessaoConvenio } from '@/server/persistence/mysql/convenioRepository';

const color = { ink: '#21192b', muted: '#746b7c', deep: '#43265e', accent: '#22c7a9', line: '#e7dfeb', soft: '#f8f4fa' };
const money = (cents: number) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(cents / 100);
const date = (iso: string) => new Intl.DateTimeFormat('pt-BR', { timeZone: 'America/Sao_Paulo' }).format(
  new Date(/^\d{4}-\d{2}-\d{2}$/.test(iso) ? `${iso}T12:00:00-03:00` : iso)
);

function header(doc: PDFKit.PDFDocument, convenio: Convenio, periodo: { inicio?: string; fim?: string }) {
  doc.roundedRect(36, 32, 523, 96, 14).fill(color.deep);
  doc.font('Helvetica-Bold').fontSize(9).fillColor(color.accent).text('VIVER MAIS PSICOLOGIA', 52, 49);
  doc.font('Helvetica-Bold').fontSize(22).fillColor('#ffffff').text('Relatório de atendimentos', 52, 67);
  doc.font('Helvetica').fontSize(8).fillColor('#e9dff0').text(
    `${convenio.nome} | ${periodo.inicio ? date(periodo.inicio) : 'início'} a ${periodo.fim ? date(periodo.fim) : 'hoje'}`,
    52, 100, { width: 470 }
  );
}

function summary(doc: PDFKit.PDFDocument, sessions: readonly SessaoConvenio[]) {
  const total = sessions.reduce((sum, item) => sum + item.valorCents, 0);
  const cards = [
    ['ATENDIMENTOS', String(sessions.length)],
    ['VALOR DO PERÍODO', money(total)],
    ['FATURADOS', String(sessions.filter((item) => item.faturaId).length)],
  ];
  cards.forEach(([label, value], index) => {
    const x = 36 + index * 178;
    doc.roundedRect(x, 146, 166, 67, 10).fillAndStroke(color.soft, color.line);
    doc.font('Helvetica-Bold').fontSize(6.5).fillColor(color.muted).text(label, x + 13, 160);
    doc.font('Helvetica-Bold').fontSize(15).fillColor(color.deep).text(value, x + 13, 178, { width: 140 });
  });
}

function tableHeader(doc: PDFKit.PDFDocument, y: number) {
  doc.roundedRect(36, y, 523, 25, 5).fill(color.deep);
  doc.font('Helvetica-Bold').fontSize(6.5).fillColor('#ffffff');
  doc.text('DATA', 47, y + 9, { width: 52 });
  doc.text('PACIENTE', 107, y + 9, { width: 139 });
  doc.text('PSICÓLOGO', 254, y + 9, { width: 130 });
  doc.text('SITUAÇÃO', 392, y + 9, { width: 72 });
  doc.text('VALOR', 475, y + 9, { width: 72, align: 'right' });
  return y + 31;
}

function render(doc: PDFKit.PDFDocument, convenio: Convenio, sessions: readonly SessaoConvenio[], periodo: { inicio?: string; fim?: string }) {
  header(doc, convenio, periodo);
  summary(doc, sessions);
  let y = tableHeader(doc, 235);
  sessions.forEach((item, index) => {
    if (y > 750) {
      doc.addPage();
      header(doc, convenio, periodo);
      y = tableHeader(doc, 150);
    }
    if (index % 2 === 0) doc.rect(36, y - 5, 523, 31).fill('#fbf9fc');
    doc.font('Helvetica').fontSize(7.2).fillColor(color.ink);
    doc.text(date(item.realizadaEm), 47, y + 4, { width: 52 });
    doc.font('Helvetica-Bold').text(item.pacienteNome, 107, y + 4, { width: 139, ellipsis: true });
    doc.font('Helvetica').text(item.psicologoNome, 254, y + 4, { width: 130, ellipsis: true });
    doc.text(item.faturaId ? 'Faturado' : 'A faturar', 392, y + 4, { width: 72 });
    doc.font('Helvetica-Bold').fillColor(color.deep).text(money(item.valorCents), 475, y + 4, { width: 72, align: 'right' });
    doc.moveTo(36, y + 26).lineTo(559, y + 26).strokeColor(color.line).lineWidth(0.4).stroke();
    y += 31;
  });
  if (sessions.length === 0) {
    doc.font('Helvetica').fontSize(9).fillColor(color.muted).text('Nenhum atendimento encontrado no período.', 36, y + 24, { width: 523, align: 'center' });
  }
  const pages = doc.bufferedPageRange();
  for (let page = pages.start; page < pages.start + pages.count; page += 1) {
    doc.switchToPage(page);
    doc.font('Helvetica').fontSize(6.5).fillColor(color.muted)
      .text(`Gerado em ${new Intl.DateTimeFormat('pt-BR', { dateStyle: 'short', timeStyle: 'short', timeZone: 'America/Sao_Paulo' }).format(new Date())}`, 36, 807, { width: 360 })
      .text(`Página ${page + 1} de ${pages.count}`, 440, 807, { width: 119, align: 'right' });
  }
}

export async function gerarRelatorioConvenioPdf(convenio: Convenio, sessions: readonly SessaoConvenio[], periodo: { inicio?: string; fim?: string }): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ size: 'A4', margin: 0, compress: true, bufferPages: true });
    const chunks: Buffer[] = [];
    doc.on('data', (chunk: Buffer) => chunks.push(chunk));
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);
    render(doc, convenio, sessions, periodo);
    doc.end();
  });
}
