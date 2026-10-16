import qrcode from 'qrcode-generator';
import {
  CERTIFICATE_BAND_SHAPES,
  CERTIFICATE_BAND_WIDTH,
  CERTIFICATE_BRAND,
  CERTIFICATE_PAGE_HEIGHT,
  CERTIFICATE_PAGE_WIDTH,
  type CertificateRecord,
  certificateBodyParts,
  certificatePublicValidationUrl,
  formatCertificateDuration,
} from '@thats-life/core';
import { certificateAssets } from './certificateAssets';

const BRAND = CERTIFICATE_BRAND;
const FONT = {
  display: 'VM-Display',
  text: 'VM-Text',
  textSemi: 'VM-Text-Semibold',
  textBold: 'VM-Text-Bold',
} as const;

const CONTENT_X = CERTIFICATE_BAND_WIDTH + 56;
const CONTENT_RIGHT = CERTIFICATE_PAGE_WIDTH - 54;
const CONTENT_WIDTH = CONTENT_RIGHT - CONTENT_X;

/** Desenha o QR em vetor (um retângulo por módulo), com a zona silenciosa branca. */
export function drawQr(doc: PDFKit.PDFDocument, value: string, x: number, y: number, size: number) {
  const qr = qrcode(0, 'M');
  qr.addData(value);
  qr.make();
  const modules = qr.getModuleCount();
  const margin = 2;
  const cell = size / (modules + margin * 2);
  doc.rect(x, y, size, size).fill('#ffffff');
  for (let row = 0; row < modules; row += 1) {
    for (let col = 0; col < modules; col += 1) {
      if (qr.isDark(row, col)) {
        doc.rect(x + (col + margin) * cell, y + (row + margin) * cell, cell, cell);
      }
    }
  }
  doc.fill(BRAND.ink);
}

/** Registra as fontes da marca no documento; chamar uma vez antes das páginas sem arte. */
export function registerCertificateFonts(doc: PDFKit.PDFDocument) {
  doc.registerFont(FONT.display, certificateAssets.fraunces600());
  doc.registerFont(FONT.text, certificateAssets.interTight400());
  doc.registerFont(FONT.textSemi, certificateAssets.interTight600());
  doc.registerFont(FONT.textBold, certificateAssets.interTight800());
}

function drawBrandBand(doc: PDFKit.PDFDocument) {
  doc.save();
  doc.rect(0, 0, CERTIFICATE_BAND_WIDTH, CERTIFICATE_PAGE_HEIGHT).fill(BRAND.primary);
  doc.rect(0, 0, CERTIFICATE_BAND_WIDTH, CERTIFICATE_PAGE_HEIGHT).clip();
  for (const shape of CERTIFICATE_BAND_SHAPES) {
    doc.fillOpacity(shape.opacity).path(shape.d).fill(shape.fill);
  }
  doc.restore();
  doc.fillOpacity(1);
  doc.image(certificateAssets.logoWhite(), 30, 40, { width: 146 });
}

function drawEyebrow(doc: PDFKit.PDFDocument, label: string, y: number) {
  doc.rect(CONTENT_X, y + 3, 22, 3).fill(BRAND.accent);
  doc.font(FONT.textBold).fontSize(8.5).fillColor(BRAND.primary)
    .text(label, CONTENT_X + 32, y, { characterSpacing: 2.2, lineBreak: false });
}

function labelledValue(doc: PDFKit.PDFDocument, label: string, value: string, x: number, y: number, width: number) {
  doc.font(FONT.textBold).fontSize(7).fillColor(BRAND.muted)
    .text(label.toUpperCase(), x, y, { width, characterSpacing: 1.4, lineBreak: false });
  doc.font(FONT.textSemi).fontSize(12).fillColor(BRAND.ink)
    .text(value, x, y + 14, { width });
}

function durationLabel(record: CertificateRecord): string {
  const minutes = record.certificateDurationMinutes;
  return (minutes ? formatCertificateDuration(minutes) : '') || record.durationHours;
}

/** Frente do certificado quando o curso não tem arte própria. */
export function drawFallbackFront(doc: PDFKit.PDFDocument, record: CertificateRecord) {
  doc.rect(0, 0, CERTIFICATE_PAGE_WIDTH, CERTIFICATE_PAGE_HEIGHT).fill('#ffffff');
  drawBrandBand(doc);
  drawEyebrow(doc, 'CERTIFICADO DE CONCLUSÃO', 62);

  const parts = certificateBodyParts(record) ?? {
    lead: 'Certificamos oficialmente que',
    studentName: record.studentName,
    before: 'concluiu com aproveitamento e frequência integral o curso de extensão / formação profissional em',
    courseTitle: record.courseTitle,
    after: '.',
  };

  doc.font(FONT.text).fontSize(13).fillColor(BRAND.muted)
    .text(parts.lead, CONTENT_X, 134, { width: CONTENT_WIDTH, lineBreak: false });

  // O nome encolhe até caber numa linha; abaixo de 26pt quebra em duas.
  let nameSize = 40;
  doc.font(FONT.display);
  while (nameSize > 26 && doc.fontSize(nameSize).widthOfString(parts.studentName) > CONTENT_WIDTH) nameSize -= 1;
  doc.font(FONT.display).fontSize(nameSize).fillColor(BRAND.ink)
    .text(parts.studentName, CONTENT_X, 158, { width: CONTENT_WIDTH, lineGap: 2 });

  const ruleY = doc.y + 12;
  doc.moveTo(CONTENT_X, ruleY).lineTo(CONTENT_RIGHT, ruleY).lineWidth(1).stroke(BRAND.line);
  doc.rect(CONTENT_X, ruleY - 1, 56, 3).fill(BRAND.accent);

  doc.font(FONT.text).fontSize(14).fillColor(BRAND.ink)
    .text(`${parts.before} `, CONTENT_X, ruleY + 26, { width: CONTENT_WIDTH, lineGap: 8, continued: true })
    .font(FONT.textSemi).fillColor(BRAND.primary)
    .text(parts.courseTitle, { continued: true })
    .font(FONT.text).fontSize(14).fillColor(BRAND.ink)
    .text(parts.after);

  // Faixa de dados: duração, modalidade (só no modelo online) e emissão.
  const factsY = Math.max(doc.y + 30, 388);
  doc.moveTo(CONTENT_X, factsY - 14).lineTo(CONTENT_RIGHT, factsY - 14).lineWidth(0.75).stroke(BRAND.line);
  const online = record.certificateTextModel === 'online-course-with-instructor';
  const facts: Array<[string, string]> = [
    [online ? 'Duração' : 'Carga horária', durationLabel(record)],
    ...(online ? ([['Modalidade', 'Online']] as Array<[string, string]>) : []),
    ['Emissão', record.issueDate],
  ];
  const columnWidth = CONTENT_WIDTH / facts.length;
  facts.forEach(([label, value], index) => {
    labelledValue(doc, label, value, CONTENT_X + index * columnWidth, factsY, columnWidth - 12);
  });

  // Rodapé: assinatura à esquerda; código de registro e QR à direita.
  const footerY = 486;
  doc.moveTo(CONTENT_X, footerY + 36).lineTo(CONTENT_X + 190, footerY + 36).lineWidth(0.75).stroke(BRAND.ink);
  doc.font(FONT.textSemi).fontSize(10.5).fillColor(BRAND.ink)
    .text('Dra. Viviane Jeremias', CONTENT_X, footerY + 43, { width: 220, lineBreak: false });
  doc.font(FONT.text).fontSize(8.5).fillColor(BRAND.muted)
    .text('Direção Acadêmica · Viver Mais Psicologia', CONTENT_X, footerY + 58, { width: 240, lineBreak: false });

  const qrSize = 66;
  const qrX = CONTENT_RIGHT - qrSize;
  const textRight = qrX - 14;
  const validationUrl = certificatePublicValidationUrl();
  drawQr(doc, validationUrl, qrX, footerY - 4, qrSize);
  doc.rect(qrX, footerY - 4, qrSize, qrSize).lineWidth(0.75).stroke(BRAND.line);
  doc.font(FONT.textBold).fontSize(7).fillColor(BRAND.muted)
    .text('CÓDIGO DE REGISTRO', textRight - 200, footerY + 8, { width: 200, align: 'right', characterSpacing: 1.4, lineBreak: false });
  doc.font(FONT.textSemi).fontSize(12).fillColor(BRAND.primary)
    .text(record.code, textRight - 200, footerY + 21, { width: 200, align: 'right', lineBreak: false });
  doc.font(FONT.text).fontSize(8).fillColor(BRAND.muted)
    .text(`Valide em ${validationUrl.replace(/^https?:\/\//, '')}`, textRight - 200, footerY + 40, { width: 200, align: 'right', lineBreak: false });
}

/** Verso do certificado quando o curso não tem arte própria; o carimbo é desenhado por cima. */
export function drawFallbackBack(doc: PDFKit.PDFDocument, record: CertificateRecord) {
  doc.rect(0, 0, CERTIFICATE_PAGE_WIDTH, CERTIFICATE_PAGE_HEIGHT).fill('#ffffff');
  drawBrandBand(doc);
  drawEyebrow(doc, 'DOCUMENTO OFICIAL', 62);

  doc.font(FONT.display).fontSize(28).fillColor(BRAND.ink)
    .text('Registro Acadêmico Oficial', CONTENT_X, 100, { width: CONTENT_WIDTH, lineBreak: false });

  const online = record.certificateTextModel === 'online-course-with-instructor';
  const rows: Array<[string, string]> = [
    ['Curso', record.courseTitle],
    ['Aluno(a)', record.studentName],
    [online ? 'Duração' : 'Carga horária', durationLabel(record)],
  ];
  if (record.certificateInstructor?.trim()) rows.push(['Ministrante', record.certificateInstructor.trim()]);
  if (online) rows.push(['Modalidade', 'Online']);
  rows.push(['Emitido em', record.issueDate], ['Código', record.code]);

  const labelWidth = 118;
  const valueX = CONTENT_X + labelWidth;
  const valueWidth = CONTENT_WIDTH - labelWidth;
  let y = 160;
  doc.moveTo(CONTENT_X, y).lineTo(CONTENT_RIGHT, y).lineWidth(0.75).stroke(BRAND.line);
  for (const [label, value] of rows) {
    doc.font(FONT.textSemi).fontSize(11.5);
    const height = doc.heightOfString(value, { width: valueWidth });
    doc.font(FONT.textBold).fontSize(7).fillColor(BRAND.muted)
      .text(label.toUpperCase(), CONTENT_X, y + 14, { width: labelWidth - 12, characterSpacing: 1.4, lineBreak: false });
    doc.font(label === 'Código' ? FONT.textBold : FONT.textSemi).fontSize(11.5)
      .fillColor(label === 'Código' ? BRAND.primary : BRAND.ink)
      .text(value, valueX, y + 11, { width: valueWidth });
    y += height + 22;
    doc.moveTo(CONTENT_X, y).lineTo(CONTENT_RIGHT, y).lineWidth(0.75).stroke(BRAND.line);
  }
}
