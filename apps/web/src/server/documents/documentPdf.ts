import 'server-only';
import PDFDocument from 'pdfkit';
import { documentDateLabel, type IssuedPsychologicalDocument } from '@thats-life/core';

export async function psychologicalDocumentPdf(document: IssuedPsychologicalDocument): Promise<Buffer> {
  const content = document.content;
  const pdf = new PDFDocument({ size: 'A4', margins: { top: 56, bottom: 65, left: 60, right: 60 }, bufferPages: true,
    info: { Title: content.title, Author: content.professionalName } });
  const chunks: Buffer[] = [];
  const result = new Promise<Buffer>((resolve, reject) => {
    pdf.on('data', (chunk: Buffer) => chunks.push(chunk));
    pdf.on('end', () => resolve(Buffer.concat(chunks)));
    pdf.on('error', reject);
  });
  pdf.font('Helvetica-Bold').fontSize(12).text(content.organizationName, { align: 'center' });
  if (content.demo) pdf.moveDown().fontSize(10).text('DEMONSTRAÇÃO - SEM VALIDADE CLÍNICA', { align: 'center' });
  pdf.moveDown(2).fontSize(15).text(content.title.toLocaleUpperCase('pt-BR'), { align: 'center' });
  pdf.moveDown(2);
  for (const section of content.sections) {
    if (section.heading) {
      if (pdf.y > 690) pdf.addPage();
      pdf.font('Helvetica-Bold').fontSize(11).text(section.heading).moveDown(0.5);
    }
    pdf.font('Helvetica').fontSize(11).text(section.text, { lineGap: 5, align: 'left' }).moveDown(1);
  }
  if (pdf.y > 620) pdf.addPage();
  pdf.moveDown().font('Helvetica').fontSize(11).text(`${content.location}, ${documentDateLabel(content.date)}.`, { align: 'right' });
  pdf.moveDown(4).text('________________________________________________', { align: 'center' });
  pdf.text(content.professionalName, { align: 'center' });
  pdf.text(`Psicóloga(o) - CRP ${content.crp}`, { align: 'center' });
  const pages = pdf.bufferedPageRange();
  for (let page = 0; page < pages.count; page++) {
    pdf.switchToPage(page);
    const bottomMargin = pdf.page.margins.bottom;
    pdf.page.margins.bottom = 0;
    pdf.font('Helvetica').fontSize(8).fillColor('#555555');
    pdf.text(`Documento ${document.id.slice(0, 12)} | ${page + 1}/${pages.count}${page < pages.count - 1 ? ' | Rubrica: ______________' : ''}`, 60, 790, { width: 475, align: 'center', lineBreak: false });
    pdf.page.margins.bottom = bottomMargin;
  }
  pdf.end();
  return result;
}
