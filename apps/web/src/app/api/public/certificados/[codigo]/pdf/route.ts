import { NextResponse } from 'next/server';
import PDFDocument from 'pdfkit';
import { certificadosRepo } from '@/server/certificados/certificadosRepository';
import qrcode from 'qrcode-generator';
import {
  CERT_FONT_BASE_WIDTH,
  DEFAULT_FRONT_QR_SIZE,
  DEFAULT_STAMP_FONT_SIZE,
  DEFAULT_STAMP_WIDTH,
  DEFAULT_STAMP_X,
  DEFAULT_STAMP_Y,
  STAMP_LINE_HEIGHT,
  STAMP_QR_FONT_RATIO,
  certificatePublicValidationUrl,
  resolveCertificateStampText,
} from '@thats-life/core';
import { proxyToPersistentBackend } from '@/server/http/persistentBackendProxy';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/** Desenha o QR em vetor (um retângulo por módulo), com a zona silenciosa branca. */
function drawQr(doc: PDFKit.PDFDocument, value: string, x: number, y: number, size: number) {
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
  doc.fill('#1e1b4b');
}

/** Área que a arte ocupa na página — a mesma referência das % gravadas no editor. */
interface ArtRect {
  x: number;
  y: number;
  width: number;
  height: number;
}

/**
 * Desenha a arte inteira, centralizada, e devolve onde ela ficou. Se a proporção
 * da arte não for a do A4, sobram faixas — e as % do editor valem sobre a arte,
 * não sobre a folha.
 */
function drawArt(doc: PDFKit.PDFDocument, buf: Buffer, pageWidth: number, pageHeight: number): ArtRect {
  // `openImage` existe no PDFKit, mas falta nos tipos; o objeto devolvido é aceito por `doc.image`.
  const image = (doc as unknown as { openImage(src: Buffer): { width: number; height: number } }).openImage(buf);
  const scale = Math.min(pageWidth / image.width, pageHeight / image.height);
  const width = image.width * scale;
  const height = image.height * scale;
  const rect = { x: (pageWidth - width) / 2, y: (pageHeight - height) / 2, width, height };
  doc.image(image as unknown as Buffer, rect.x, rect.y, { width, height });
  return rect;
}

function extractBase64Buffer(dataUrl: string): Buffer | null {
  try {
    const matches = dataUrl.match(/^data:([A-Za-z-+\/]+);base64,(.+)$/);
    if (matches && matches[2]) {
      return Buffer.from(matches[2], 'base64');
    }
    return null;
  } catch {
    return null;
  }
}

export async function GET(
  request: Request,
  { params }: { params: Promise<{ codigo: string }> }
) {
  const proxied = await proxyToPersistentBackend(request);
  if (proxied) return proxied;

  try {
    const { codigo } = await params;
    const codeParam = decodeURIComponent(codigo).trim();
    const record = await certificadosRepo.porCodigo(codeParam);

    if (!record) {
      return NextResponse.json({ ok: false, error: 'Certificado não encontrado' }, { status: 404 });
    }

    const versoText = resolveCertificateStampText(record);

    const doc = new PDFDocument({
      size: 'A4',
      layout: 'landscape',
      margin: 0,
      info: {
        Title: `Certificado - ${record.studentName} - ${record.code}`,
        Author: 'Viver Mais Psicologia',
        Subject: record.courseTitle,
      },
    });

    const chunks: Buffer[] = [];
    doc.on('data', (chunk) => chunks.push(chunk));

    const PAGE_WIDTH = 841.89;
    const PAGE_HEIGHT = 595.28;
    const FULL_PAGE: ArtRect = { x: 0, y: 0, width: PAGE_WIDTH, height: PAGE_HEIGHT };

    // --- PÁGINA 1: FRENTE DO CERTIFICADO ---
    if (record.frontImageUrl) {
      const frontBuf = extractBase64Buffer(record.frontImageUrl);
      const frontArt = frontBuf ? drawArt(doc, frontBuf, PAGE_WIDTH, PAGE_HEIGHT) : FULL_PAGE;

      // Sobreposição do QR code oficial de conferência na Frente (se habilitado)
      if (record.frontQrEnabled !== false && record.frontQrX != null && record.frontQrY != null) {
        const qrFrontXPt = frontArt.x + (frontArt.width * record.frontQrX) / 100;
        const qrFrontYPt = frontArt.y + (frontArt.height * record.frontQrY) / 100;
        const qrFrontSizePt = (frontArt.width * (record.frontQrSize || DEFAULT_FRONT_QR_SIZE)) / 100;
        drawQr(doc, certificatePublicValidationUrl(), qrFrontXPt, qrFrontYPt, qrFrontSizePt);
      }
    } else {
      // Template padrão limpo se não tiver imagem
      doc.rect(0, 0, PAGE_WIDTH, PAGE_HEIGHT).fill('#ffffff');
      doc.font('Helvetica-Bold').fontSize(26).fillColor('#3B1B54')
        .text('Viver Mais Psicologia', 60, 80, { align: 'center', width: PAGE_WIDTH - 120 });
      doc.font('Helvetica').fontSize(14).fillColor('#666666')
        .text('Certificado Oficial de Conclusão', 60, 120, { align: 'center', width: PAGE_WIDTH - 120 });
      doc.font('Helvetica-Bold').fontSize(22).fillColor('#111827')
        .text(record.studentName, 60, 230, { align: 'center', width: PAGE_WIDTH - 120 });
      doc.font('Helvetica').fontSize(14).fillColor('#4B5563')
        .text(record.courseTitle, 60, 270, { align: 'center', width: PAGE_WIDTH - 120 });
      doc.font('Helvetica').fontSize(11).fillColor('#6B7280')
        .text(`Carga Horária: ${record.durationHours} · Emissão: ${record.issueDate}`, 60, 310, { align: 'center', width: PAGE_WIDTH - 120 });
    }

    // --- PÁGINA 2: VERSO COM CARIMBO OFICIAL TRANSPARENTE ---
    doc.addPage({ size: 'A4', layout: 'landscape', margin: 0 });

    let backArt = FULL_PAGE;
    if (record.backImageUrl) {
      const backBuf = extractBase64Buffer(record.backImageUrl);
      if (backBuf) backArt = drawArt(doc, backBuf, PAGE_WIDTH, PAGE_HEIGHT);
    } else {
      doc.rect(0, 0, PAGE_WIDTH, PAGE_HEIGHT).fill('#ffffff');
      doc.font('Helvetica-Bold').fontSize(14).fillColor('#3B1B54')
        .text('Registro Acadêmico Oficial', 60, 80, { align: 'left' });
      doc.font('Helvetica').fontSize(11).fillColor('#4B5563')
        .text(`Curso: ${record.courseTitle}\nAluno(a): ${record.studentName}\nCarga: ${record.durationHours}\nCódigo: ${record.code}`, 60, 110, { lineGap: 4 });
    }

    // Sobreposição do Carimbo Oficial Transparente no Verso
    const stampXPercent = record.stampX !== undefined ? record.stampX : DEFAULT_STAMP_X;
    const stampYPercent = record.stampY !== undefined ? record.stampY : DEFAULT_STAMP_Y;
    const stampXPt = backArt.x + (backArt.width * stampXPercent) / 100;
    const stampYPt = backArt.y + (backArt.height * stampYPercent) / 100;
    // Fonte em milésimos da largura da arte, a mesma unidade do editor.
    const fontSizePt = ((record.stampFontSize || DEFAULT_STAMP_FONT_SIZE) * backArt.width) / CERT_FONT_BASE_WIDTH;
    const alignPdf = record.stampAlign === 'left' ? 'left' : record.stampAlign === 'right' ? 'right' : 'center';

    const stampWidthPt = (backArt.width * (record.stampWidth || DEFAULT_STAMP_WIDTH)) / 100;
    // Mesma proporção do editor: o QR cresce com a fonte.
    const qrSizePt = fontSizePt * STAMP_QR_FONT_RATIO;
    const gapPt = fontSizePt * 0.6;
    // Altura de linha igual à do editor (`STAMP_LINE_HEIGHT`): o PDFKit soma `lineGap` à altura natural da fonte.
    doc.font('Courier').fontSize(fontSizePt);
    const lineGap = Math.max(0, fontSizePt * STAMP_LINE_HEIGHT - doc.currentLineHeight());
    let textX = stampXPt;
    let textY = stampYPt;
    let textWidth = stampWidthPt;

    if (record.stampQr === 'left') {
      drawQr(doc, certificatePublicValidationUrl(), stampXPt, stampYPt, qrSizePt);
      textX += qrSizePt + gapPt;
      textWidth = Math.max(fontSizePt * 6, stampWidthPt - qrSizePt - gapPt);
      doc.font('Courier').fontSize(fontSizePt);
      const textHeight = doc.heightOfString(versoText, { width: textWidth, lineGap });
      textY += Math.max(0, (qrSizePt - textHeight) / 2);
    } else if (record.stampQr === 'top') {
      const qrX =
        alignPdf === 'left' ? stampXPt
          : alignPdf === 'right' ? stampXPt + stampWidthPt - qrSizePt
          : stampXPt + (stampWidthPt - qrSizePt) / 2;
      drawQr(doc, certificatePublicValidationUrl(), qrX, stampYPt, qrSizePt);
      textY += qrSizePt + gapPt;
    }

    doc.font('Courier').fontSize(fontSizePt).fillColor('#111827')
      .text(versoText, textX, textY, {
        width: textWidth,
        // Carimbo encostado no pé do verso: corta no fim da página em vez de abrir uma página extra.
        height: Math.max(fontSizePt, PAGE_HEIGHT - textY),
        align: alignPdf,
        lineGap,
      });

    doc.end();

    const pdfBuffer = await new Promise<Buffer>((resolve) => {
      doc.on('end', () => resolve(Buffer.concat(chunks)));
    });

    return new Response(new Uint8Array(pdfBuffer), {
      status: 200,
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `inline; filename="Certificado-ViverMais-${record.code}.pdf"`,
        'Cache-Control': 'public, max-age=3600, stale-while-revalidate=86400',
      },
    });
  } catch (error) {
    console.error('Erro ao gerar PDF do certificado:', error);
    return NextResponse.json({ ok: false, error: 'Erro interno ao gerar PDF' }, { status: 500 });
  }
}
