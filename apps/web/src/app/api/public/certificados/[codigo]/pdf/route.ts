import { NextResponse } from 'next/server';
import PDFDocument from 'pdfkit';
import { certificadosRepo } from '@/server/certificados/certificadosRepository';
import { formatCertificateVersoText } from '@thats-life/core';
import { proxyToPersistentBackend } from '@/server/http/persistentBackendProxy';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

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

    const versoText = formatCertificateVersoText({
      signerInfo: record.signerInfo,
      durationHours: record.durationHours,
      issueDate: record.issueDate,
      validationUrl: record.validationUrl,
      code: record.code,
    });

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

    // --- PÁGINA 1: FRENTE DO CERTIFICADO ---
    if (record.frontImageUrl) {
      const frontBuf = extractBase64Buffer(record.frontImageUrl);
      if (frontBuf) {
        doc.image(frontBuf, 0, 0, {
          width: PAGE_WIDTH,
          height: PAGE_HEIGHT,
          fit: [PAGE_WIDTH, PAGE_HEIGHT],
          align: 'center',
          valign: 'center',
        });
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

    if (record.backImageUrl) {
      const backBuf = extractBase64Buffer(record.backImageUrl);
      if (backBuf) {
        doc.image(backBuf, 0, 0, {
          width: PAGE_WIDTH,
          height: PAGE_HEIGHT,
          fit: [PAGE_WIDTH, PAGE_HEIGHT],
          align: 'center',
          valign: 'center',
        });
      }
    } else {
      doc.rect(0, 0, PAGE_WIDTH, PAGE_HEIGHT).fill('#ffffff');
      doc.font('Helvetica-Bold').fontSize(14).fillColor('#3B1B54')
        .text('Registro Acadêmico Oficial', 60, 80, { align: 'left' });
      doc.font('Helvetica').fontSize(11).fillColor('#4B5563')
        .text(`Curso: ${record.courseTitle}\nAluno(a): ${record.studentName}\nCarga: ${record.durationHours}\nCódigo: ${record.code}`, 60, 110, { lineGap: 4 });
    }

    // Sobreposição do Carimbo Oficial Transparente no Verso
    const stampXPercent = record.stampX !== undefined ? record.stampX : 15;
    const stampYPercent = record.stampY !== undefined ? record.stampY : 75;
    const stampXPt = (PAGE_WIDTH * stampXPercent) / 100;
    const stampYPt = (PAGE_HEIGHT * stampYPercent) / 100;
    const fontSizePt = Math.max(7, Math.min(24, ((record.stampFontSize || 11) * PAGE_WIDTH) / 1000));
    const alignPdf = record.stampAlign === 'left' ? 'left' : record.stampAlign === 'right' ? 'right' : 'center';

    doc.font('Courier').fontSize(fontSizePt).fillColor('#111827')
      .text(versoText, stampXPt, stampYPt, {
        width: PAGE_WIDTH * 0.85,
        align: alignPdf,
        lineGap: 2,
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
