import 'server-only';

import PDFDocument from 'pdfkit';
import {
  TERMO_ADESAO_CLAUSULAS,
  TERMO_ADESAO_HONORARIOS_CABECALHOS,
  TERMO_ADESAO_SUBTITULO,
  TERMO_ADESAO_PAINEL,
  TERMO_ADESAO_HONORARIOS,
  TERMO_ADESAO_IDENTIFICACAO,
  TERMO_ADESAO_TITULO,
  VERSAO_TERMO_ADESAO,
} from '@/components/forms/termoAdesaoContent';
import { certificateAssets } from '@/server/certificados/certificateAssets';
import type { CadastroPsicologoRecord } from '@/server/application/persistence';
import { gerarComprovanteTermoAdesaoPdf as gerarComprovanteLegado } from './termoAdesaoComprovantePdf2026_2';
import { fonteTermoAdesao } from './termoAdesaoFont';
import {
  codigoVerificacaoAceite,
  dataHoraBrasilia,
  nomeArquivoComprovante,
  sha256,
  type ComprovanteGerado,
} from './termoAdesaoComprovante';

const COR = { tinta: '#2a2028', marca: '#43265e', suave: '#6b6170', linha: '#d9cfe0', fundo: '#f6f1f9' };
const FONTE = { texto: 'TL-Texto', semi: 'TL-Semi', negrito: 'TL-Negrito' };
const MARGEM = 24;
const LARGURA = 595.28 - MARGEM * 2;
const LIMITE_Y = 841.89 - 44;

function garantirEspaco(pdf: PDFKit.PDFDocument, altura: number) {
  if (pdf.y + altura > LIMITE_Y) pdf.addPage();
}

function titulo(pdf: PDFKit.PDFDocument, texto: string) {
  garantirEspaco(pdf, 60);
  pdf.moveDown(0.55).font(FONTE.negrito).fontSize(11).fillColor(COR.marca)
    .text(texto.toLocaleUpperCase('pt-BR'), MARGEM, pdf.y, { width: LARGURA, characterSpacing: 0.4 });
  pdf.moveDown(0.25).fillColor(COR.tinta);
}

function paragrafo(pdf: PDFKit.PDFDocument, texto: string) {
  pdf.font(FONTE.texto).fontSize(10.5).fillColor(COR.tinta)
    .text(texto, MARGEM, pdf.y, { width: LARGURA, align: 'justify', lineGap: 1 });
  pdf.moveDown(0.25);
}

function campo(pdf: PDFKit.PDFDocument, rotulo: string, valor: string, mono = false) {
  const alturaValor = pdf.font(FONTE.texto).fontSize(mono ? 8 : 9.5).heightOfString(valor, { width: LARGURA - 150 });
  garantirEspaco(pdf, alturaValor + 6);
  const y = pdf.y;
  pdf.font(FONTE.semi).fontSize(8.5).fillColor(COR.suave).text(rotulo, MARGEM, y, { width: 140 });
  pdf.font(FONTE.texto).fontSize(mono ? 8 : 9.5).fillColor(COR.tinta)
    .text(valor, MARGEM + 150, y, { width: LARGURA - 150 });
  pdf.y = Math.max(pdf.y, y + 12) + 4;
}

function tabelaHonorarios(pdf: PDFKit.PDFDocument) {
  const larguras = [0.32, 0.12, 0.14, 0.21, 0.21];
  const linhas = [TERMO_ADESAO_HONORARIOS_CABECALHOS,
    ...TERMO_ADESAO_HONORARIOS.map((h) => [h.servico, h.particular, h.social, h.pacoteSocial, h.pacoteParticular])];
  const alturas = linhas.map((linha, indice) => Math.max(...linha.map((texto, col) =>
    pdf.font(indice === 0 ? FONTE.negrito : FONTE.texto).fontSize(8.5)
      .heightOfString(texto, { width: LARGURA * larguras[col] - 10, lineGap: 1 }))) + 12);
  garantirEspaco(pdf, alturas.reduce((soma, altura) => soma + altura, 0) + 8);
  linhas.forEach((linha, indice) => {
    const y = pdf.y;
    const altura = alturas[indice];
    if (indice === 0) pdf.rect(MARGEM, y, LARGURA, altura).fill(COR.marca);
    else if (indice % 2 === 0) pdf.rect(MARGEM, y, LARGURA, altura).fill(COR.fundo);
    let x = MARGEM;
    linha.forEach((celula, col) => {
      const largura = LARGURA * larguras[col];
      pdf.font(indice === 0 ? FONTE.negrito : FONTE.texto).fontSize(8.5)
        .fillColor(indice === 0 ? '#ffffff' : COR.tinta)
        .text(celula, x + 5, y + 6, { width: largura - 10, align: col === 0 ? 'left' : 'center', lineGap: 1 });
      x += largura;
    });
    pdf.y = y + altura;
  });
  pdf.moveDown(0.4);
}

function manifesto(pdf: PDFKit.PDFDocument, cadastro: CadastroPsicologoRecord, codigo: string) {
  const aceite = cadastro.aceiteTermoAdesao!;
  pdf.font(FONTE.semi).fontSize(8).fillColor(COR.marca)
    .text('VIVER MAIS PSICOLOGIA · CNPJ 19.440.737/0001-53 · CRP 12/0598PJ', MARGEM, MARGEM, { width: LARGURA, align: 'center', characterSpacing: 0.6 });
  pdf.moveDown(0.8).font(FONTE.negrito).fontSize(17).fillColor(COR.tinta)
    .text('Comprovante de Aceite Eletrônico', { width: LARGURA, align: 'center' });
  pdf.font(FONTE.texto).fontSize(10).fillColor(COR.suave)
    .text(`${TERMO_ADESAO_TITULO} · versão ${aceite.versao}`, { width: LARGURA, align: 'center' });

  titulo(pdf, 'Profissional que aceitou');
  campo(pdf, 'Nome completo', cadastro.nomeCompleto.trim());
  if (cadastro.nomeSocial?.trim()) campo(pdf, 'Nome social', cadastro.nomeSocial.trim());
  campo(pdf, 'Inscrição no CRP', cadastro.crp.trim());
  campo(pdf, 'E-mail informado', cadastro.email?.trim() || 'não informado');
  campo(pdf, 'WhatsApp informado', cadastro.whatsapp || 'não informado');
  if (cadastro.cidadeUf) campo(pdf, 'Cidade/UF', cadastro.cidadeUf);
  campo(pdf, 'Identificador do cadastro', cadastro.id, true);

  titulo(pdf, 'Registro do aceite (apurado pelo servidor)');
  campo(pdf, 'Data e hora', dataHoraBrasilia(aceite.aceitoEm));
  campo(pdf, 'Carimbo UTC (ISO 8601)', aceite.aceitoEm, true);
  campo(pdf, 'Endereço IP', aceite.ip ?? 'não identificado');
  campo(pdf, 'Navegador', aceite.navegador ?? 'não informado', true);
  campo(pdf, 'Forma de manifestação', 'Leitura integral do termo no formulário de credenciamento, seguida do clique em « Li e Aceito os Termos » e envio do cadastro.');
  campo(pdf, `Hash do texto (${aceite.hashAlgoritmo})`, aceite.hashTexto
    ?? `sem hash: a versão exibida (${aceite.versao}) não era a vigente no servidor (${VERSAO_TERMO_ADESAO})`, true);
  campo(pdf, 'Código de verificação', codigo, true);

  titulo(pdf, 'Validade e integridade');
  paragrafo(pdf, 'O aceite foi manifestado eletronicamente e é admitido como meio de comprovação de autoria e integridade, nos termos do art. 10, § 2º, da Medida Provisória nº 2.200-2/2001 e da Lei nº 14.063/2020, conforme a cláusula 10 do próprio termo.');
  paragrafo(pdf, 'Este comprovante registra a prova do aceite manifestado no envio do cadastro. A via institucional é enviada à clínica na solicitação; a via do profissional acompanha o e-mail de acesso após a aprovação pela gestão. O hash SHA-256 deste arquivo PDF fica registrado no cadastro e consta do e-mail de envio: qualquer alteração no arquivo muda esse hash. O hash do texto permite conferir que a íntegra abaixo é exatamente a versão aceita.');
}

function integra(pdf: PDFKit.PDFDocument, cadastro: CadastroPsicologoRecord) {
  pdf.addPage();
  pdf.font(FONTE.negrito).fontSize(14).fillColor(COR.tinta)
    .text(`Íntegra do ${TERMO_ADESAO_TITULO}`, MARGEM, MARGEM, { width: LARGURA, align: 'center' });
  pdf.font(FONTE.texto).fontSize(9).fillColor(COR.suave)
    .text(`Versão ${VERSAO_TERMO_ADESAO}`, { width: LARGURA, align: 'center' });
  if (cadastro.aceiteTermoAdesao?.versao !== VERSAO_TERMO_ADESAO) {
    pdf.moveDown(0.5).font(FONTE.semi).fontSize(9).fillColor('#9a3412')
      .text(`Atenção: o formulário informou a versão ${cadastro.aceiteTermoAdesao?.versao}; a íntegra reproduzida é a versão vigente no servidor.`, { width: LARGURA, align: 'center' });
  }
  pdf.font(FONTE.texto).fontSize(9).text(TERMO_ADESAO_SUBTITULO, { width: LARGURA, align: 'center' });
  pdf.moveDown(0.6);
  TERMO_ADESAO_IDENTIFICACAO.forEach((texto) => paragrafo(pdf, texto));
  for (const clausula of TERMO_ADESAO_CLAUSULAS) {
    titulo(pdf, `Cláusula ${clausula.numero} — ${clausula.titulo}`);
    clausula.paragrafos.forEach((texto, indice) => {
      paragrafo(pdf, texto);
      if (clausula.numero === '05' && indice === 0) tabelaHonorarios(pdf);
    });
  }
  TERMO_ADESAO_PAINEL.forEach((texto) => paragrafo(pdf, texto));
}

function rodapes(pdf: PDFKit.PDFDocument, codigo: string) {
  const paginas = pdf.bufferedPageRange();
  for (let pagina = 0; pagina < paginas.count; pagina++) {
    pdf.switchToPage(pagina);
    const margemInferior = pdf.page.margins.bottom;
    pdf.page.margins.bottom = 0;
    pdf.moveTo(MARGEM, 810).lineTo(MARGEM + LARGURA, 810).lineWidth(0.5).stroke(COR.linha);
    pdf.font(FONTE.texto).fontSize(7).fillColor(COR.suave)
      .text(`Código de verificação ${codigo} · Página ${pagina + 1} de ${paginas.count}`, MARGEM, 817, { width: LARGURA, align: 'center', lineBreak: false });
    pdf.page.margins.bottom = margemInferior;
  }
}

/**
 * PDF do aceite: manifesto com a prova na primeira página e a íntegra do termo
 * em seguida. É determinístico para o mesmo cadastro — as datas internas do PDF
 * são a do aceite —, então pode ser regerado depois com o mesmo SHA-256.
 */
export async function gerarComprovanteTermoAdesaoPdf(cadastro: CadastroPsicologoRecord): Promise<Buffer> {
  const aceite = cadastro.aceiteTermoAdesao;
  if (!aceite) throw new Error('Cadastro sem prova de aceite do Termo de Adesão.');
  if (aceite.versao === '2026.2') return gerarComprovanteLegado(cadastro);
  if (aceite.versao !== VERSAO_TERMO_ADESAO) throw new Error('Versão do Termo de Adesão indisponível.');
  const codigo = codigoVerificacaoAceite(cadastro);
  const quando = new Date(aceite.aceitoEm);
  const pdf = new PDFDocument({
    size: 'A4', margins: { top: MARGEM, bottom: 44, left: MARGEM, right: MARGEM }, bufferPages: true,
    info: {
      Title: `Comprovante de aceite — ${TERMO_ADESAO_TITULO}`,
      Author: 'Viver Mais Psicologia',
      Subject: `Aceite de ${cadastro.nomeCompleto.trim()} (CRP ${cadastro.crp.trim()})`,
      Keywords: codigo,
      CreationDate: quando,
      ModDate: quando,
    },
  });
  const partes: Buffer[] = [];
  const resultado = new Promise<Buffer>((resolve, reject) => {
    pdf.on('data', (parte: Buffer) => partes.push(parte));
    pdf.on('end', () => resolve(Buffer.concat(partes)));
    pdf.on('error', reject);
  });
  pdf.registerFont(FONTE.texto, fonteTermoAdesao());
  pdf.registerFont(FONTE.semi, certificateAssets.interTight600());
  pdf.registerFont(FONTE.negrito, certificateAssets.interTight800());
  manifesto(pdf, cadastro, codigo);
  integra(pdf, cadastro);
  rodapes(pdf, codigo);
  pdf.end();
  return resultado;
}

export async function montarComprovanteTermoAdesao(cadastro: CadastroPsicologoRecord): Promise<ComprovanteGerado> {
  const pdf = await gerarComprovanteTermoAdesaoPdf(cadastro);
  return {
    pdf,
    arquivo: nomeArquivoComprovante(cadastro),
    sha256: sha256(pdf),
    codigoVerificacao: codigoVerificacaoAceite(cadastro),
  };
}
