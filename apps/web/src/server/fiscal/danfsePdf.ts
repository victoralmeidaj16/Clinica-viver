import 'server-only';

import PDFDocument from 'pdfkit';
import qrcode from 'qrcode-generator';
import { parseNfseXml, type NfseDocumentView } from './nfseXmlView';

const COLORS = { ink: '#1f2937', muted: '#64748b', line: '#d7dee8', accent: '#0f766e', soft: '#f0fdfa' };
const brDate = (value: string) => value ? new Intl.DateTimeFormat('pt-BR', { timeZone: 'America/Sao_Paulo' }).format(new Date(`${value}T12:00:00-03:00`)) : '—';
const brDateTime = (value: string) => value ? new Intl.DateTimeFormat('pt-BR', { dateStyle: 'short', timeStyle: 'short', timeZone: 'America/Sao_Paulo' }).format(new Date(value)) : '—';
const reais = (value: number) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value);

function cpfCnpj(value: string): string {
  const digits = value.replace(/\D/g, '');
  if (digits.length === 11) return digits.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, '$1.$2.$3-$4');
  if (digits.length === 14) return digits.replace(/(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})/, '$1.$2.$3/$4-$5');
  return value || 'Não informado';
}

function label(doc: PDFKit.PDFDocument, text: string, x: number, y: number, width: number) {
  doc.font('Helvetica-Bold').fontSize(6.5).fillColor(COLORS.muted).text(text.toUpperCase(), x, y, { width });
}

function field(doc: PDFKit.PDFDocument, title: string, text: string, x: number, y: number, width: number, bold = false) {
  label(doc, title, x, y, width);
  doc.font(bold ? 'Helvetica-Bold' : 'Helvetica').fontSize(8.5).fillColor(COLORS.ink)
    .text(text || 'Não informado', x, y + 11, { width, lineGap: 1.5 });
}

function box(doc: PDFKit.PDFDocument, title: string, y: number, height: number) {
  doc.roundedRect(36, y, 523, height, 7).lineWidth(0.8).strokeColor(COLORS.line).stroke();
  doc.font('Helvetica-Bold').fontSize(7).fillColor(COLORS.accent).text(title.toUpperCase(), 48, y + 12);
  doc.moveTo(48, y + 28).lineTo(547, y + 28).strokeColor(COLORS.line).stroke();
}

function drawQr(doc: PDFKit.PDFDocument, key: string, x: number, y: number, size: number) {
  const qr = qrcode(0, 'M');
  qr.addData(`https://www.nfse.gov.br/ConsultaPublica/?tpc=1&chave=${key}`);
  qr.make();
  const count = qr.getModuleCount();
  const cell = size / count;
  doc.save().rect(x, y, size, size).fill('#ffffff').fillColor('#111827');
  for (let row = 0; row < count; row += 1) {
    for (let column = 0; column < count; column += 1) {
      if (qr.isDark(row, column)) doc.rect(x + column * cell, y + row * cell, cell + 0.15, cell + 0.15).fill();
    }
  }
  doc.restore();
}

function render(doc: PDFKit.PDFDocument, data: NfseDocumentView, cancelled: boolean) {
  doc.info.Title = `DANFSe ${data.numero}`;
  doc.info.Author = data.prestador.nome;
  doc.rect(0, 0, 595.28, 842).fill('#ffffff');
  doc.roundedRect(36, 32, 523, 94, 9).fillAndStroke(COLORS.soft, COLORS.line);
  doc.font('Helvetica-Bold').fontSize(22).fillColor(COLORS.accent).text('NFS-e', 50, 49);
  doc.font('Helvetica-Bold').fontSize(10).fillColor(COLORS.ink).text('DANFSe v2.0', 50, 78);
  doc.font('Helvetica').fontSize(7.5).fillColor(COLORS.muted).text('Documento Auxiliar da NFS-e', 50, 92);
  doc.font('Helvetica-Bold').fontSize(12).fillColor(COLORS.ink).text(`NFS-e nº ${data.numero}`, 190, 48, { width: 270, align: 'center' });
  doc.font('Helvetica').fontSize(8).fillColor(COLORS.muted).text(`${data.municipio} · SEFIN Nacional\n${data.ambiente} · ${data.situacao}`, 190, 69, { width: 270, align: 'center', lineGap: 3 });
  drawQr(doc, data.chaveAcesso, 476, 45, 66);
  doc.font('Helvetica').fontSize(5.5).fillColor(COLORS.muted).text('Consulte a autenticidade', 469, 113, { width: 80, align: 'center' });

  if (cancelled) {
    doc.save().rotate(-27, { origin: [297, 400] }).font('Helvetica-Bold').fontSize(58)
      .fillColor('#dc2626', 0.12).text('CANCELADA', 90, 360, { width: 420, align: 'center' }).restore();
  }

  box(doc, 'Identificação', 140, 88);
  field(doc, 'Chave de acesso', data.chaveAcesso.replace(/(\d{4})(?=\d)/g, '$1 '), 48, 177, 300, true);
  field(doc, 'Competência', brDate(data.competencia), 365, 177, 80, true);
  field(doc, 'Emissão', brDateTime(data.processadaEm || data.emitidaEm), 458, 177, 89);
  doc.font('Helvetica').fontSize(6.5).fillColor(COLORS.muted).text(`DPS série ${data.serieDps} · número ${data.numeroDps}`, 48, 211);

  box(doc, 'Prestador do serviço', 242, 103);
  field(doc, 'Nome / Razão social', data.prestador.nome, 48, 279, 320, true);
  field(doc, 'CNPJ/CPF', cpfCnpj(data.prestador.documento), 382, 279, 100);
  field(doc, 'Inscrição mun.', data.prestador.inscricaoMunicipal, 488, 279, 59);
  field(doc, 'Endereço', data.prestador.endereco, 48, 315, 499);

  box(doc, 'Tomador do serviço', 359, 88);
  field(doc, 'Nome', data.tomador.nome, 48, 396, 275, true);
  field(doc, 'CNPJ/CPF', cpfCnpj(data.tomador.documento), 337, 396, 110);
  field(doc, 'E-mail', data.tomador.email, 460, 396, 87);

  box(doc, 'Serviço', 461, 127);
  field(doc, 'Descrição', data.servico.descricao.replace(/[—–‑]/g, '-'), 48, 498, 499, true);
  field(doc, 'Tributação nacional', data.servico.tributacao, 48, 541, 238);
  field(doc, 'NBS', data.servico.nbs, 300, 541, 170);
  field(doc, 'Local', data.servico.local, 480, 541, 67);

  box(doc, 'Valores', 602, 94);
  field(doc, 'Valor do serviço', reais(data.valorServico), 48, 639, 150, true);
  field(doc, 'Valor líquido', reais(data.valorLiquido), 222, 639, 150, true);
  field(doc, 'Tributos aproximados (Simples)', `${data.percentualTributos.toFixed(2).replace('.', ',')}%`, 397, 639, 150);

  doc.roundedRect(36, 711, 523, 67, 7).fillAndStroke('#f8fafc', COLORS.line);
  doc.font('Helvetica-Bold').fontSize(7).fillColor(COLORS.ink).text('AUTENTICIDADE', 48, 725);
  doc.font('Helvetica').fontSize(7).fillColor(COLORS.muted)
    .text('A autenticidade desta NFS-e pode ser verificada pelo QR Code ou no Portal Nacional da NFS-e.', 48, 740, { width: 390, lineGap: 2 });
  doc.font('Helvetica').fontSize(6.3).fillColor(COLORS.muted).text('Documento auxiliar gerado a partir do XML fiscal assinado e armazenado pela clínica.', 48, 765, { width: 499 });
  doc.font('Helvetica').fontSize(5.5).fillColor(COLORS.muted).text('Viver Mais Psicologia · geração segura pela plataforma', 36, 804, { width: 523, align: 'center' });
}

export async function gerarDanfsePdf(xml: string, options: { cancelled?: boolean } = {}): Promise<Buffer> {
  const data = parseNfseXml(xml);
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ size: 'A4', margin: 0, compress: true, autoFirstPage: true });
    const chunks: Buffer[] = [];
    doc.on('data', (chunk: Buffer) => chunks.push(chunk));
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);
    render(doc, data, options.cancelled === true);
    doc.end();
  });
}
