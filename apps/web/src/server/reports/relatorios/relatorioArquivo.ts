import 'server-only';

import PDFDocument from 'pdfkit';
import writeExcelFile, { type SheetData } from 'write-excel-file/node';
import { formatarCelula, type ColunaRelatorio, type FiltrosAplicados } from '@/lib/relatorios/areas';
import { certificateAssets } from '@/server/certificados/certificateAssets';
import type { RelatorioDaArea } from './relatoriosArea';

/**
 * Exportação Excel (.xlsx) e PDF de qualquer área (13.05). Números e valores
 * vão como número na planilha, para somar e filtrar no Excel; datas, já no
 * fuso da clínica.
 */

const ROTULO_FILTRO: Record<keyof FiltrosAplicados, string> = {
  desde: 'De', ate: 'Até', profissional: 'Psicólogo', paciente: 'Paciente', curso: 'Curso', turma: 'Turma', empresa: 'Empresa', modulo: 'Módulo',
};

const dataBr = (dia: string) => dia.split('-').reverse().join('/');

export function descricaoDosFiltros(relatorio: RelatorioDaArea): string {
  const partes = (Object.entries(relatorio.filtros) as Array<[keyof FiltrosAplicados, string | undefined]>)
    .filter(([, valor]) => Boolean(valor))
    .map(([nome, valor]) => `${ROTULO_FILTRO[nome]}: ${nome === 'desde' || nome === 'ate' ? dataBr(valor!) : valor}`);
  const periodo = relatorio.area.periodoSobre && (relatorio.filtros.desde || relatorio.filtros.ate)
    ? ` (o período considera: ${relatorio.area.periodoSobre})` : '';
  return partes.length ? `${partes.join(' · ')}${periodo}` : 'Sem filtros: todos os registros';
}

function valorPlanilha(valor: string | number | null | undefined, coluna: ColunaRelatorio) {
  if (valor === null || valor === undefined || valor === '') return null;
  if ((coluna.tipo === 'moeda' || coluna.tipo === 'numero') && typeof valor === 'number') {
    return { value: valor, type: Number, ...(coluna.tipo === 'moeda' ? { format: '"R$" #,##0.00' } : {}) };
  }
  return { value: formatarCelula(valor, coluna.tipo), type: String };
}

function totais(relatorio: RelatorioDaArea): Map<string, number> {
  const soma = new Map<string, number>();
  for (const coluna of relatorio.area.colunas.filter((c) => c.tipo === 'moeda')) {
    soma.set(coluna.chave, relatorio.linhas.reduce((n, linha) => n + (typeof linha[coluna.chave] === 'number' ? Number(linha[coluna.chave]) : 0), 0));
  }
  return soma;
}

async function planilha(relatorio: RelatorioDaArea): Promise<Buffer> {
  const { colunas } = relatorio.area;
  const soma = totais(relatorio);
  const cabecalho = colunas.map((c) => ({ value: c.rotulo, fontWeight: 'bold' as const }));
  const linhas = relatorio.linhas.map((linha) => colunas.map((c) => valorPlanilha(linha[c.chave], c)));
  const rodape = soma.size
    ? [colunas.map((c, i) => (i === 0 ? { value: 'Total', fontWeight: 'bold' as const } : soma.has(c.chave)
      ? { value: soma.get(c.chave)!, type: Number, format: '"R$" #,##0.00', fontWeight: 'bold' as const } : null))]
    : [];
  const titulo = [[{ value: `${relatorio.area.titulo} — ${descricaoDosFiltros(relatorio)}`, fontWeight: 'bold' as const }], []];
  const dados = [...titulo, cabecalho, ...linhas, ...rodape] as SheetData;
  return writeExcelFile(dados, {
    sheet: relatorio.area.titulo.slice(0, 31),
    columns: colunas.map((c) => ({ width: c.tipo === 'texto' ? 26 : 16 })),
  }).toBuffer();
}

/*
 * PDF no design da plataforma (docs/design/design.md): roxos psi-*, Inter
 * Tight, bloco escuro com o logo, faixa de resumo lilás e a tabela num card
 * de borda clara. A primeira página traz o cabeçalho completo; as seguintes
 * repetem só o título curto e o cabeçalho da tabela.
 */

const COR = {
  escuro: '#43265E', // psi-darkest
  tinta: '#1E1528', // ink
  suave: '#756785', // muted
  linha: '#F0E9F5', // line
  faixa: '#F7F3FB',
  divisoria: '#E6DCF0',
};

/** Cor só no ícone, como a TagStatus: emerald-600, amber-600, rose-600, psi-vibrant e slate-400. */
const COR_DO_TOM = { positivo: '#059669', atencao: '#D97706', negativo: '#E11D48', marca: '#9E6BCF', neutro: '#94A3B8' };
type Tom = keyof typeof COR_DO_TOM;

const FONTE = { texto: 'Relatorio-Texto', semi: 'Relatorio-Semi', negrito: 'Relatorio-Negrito' };
const MARGEM = 36;
const RAIO = 14;
const PAD_CARD = 10;
const PAD_CELULA = 5;
const PAD_LINHA = 5;
const CORPO = 7.8;
const ROTULO = 7.4;
const ICONE = 9;

/** Situação da linha → cor do ponto. O texto continua dizendo o estado; a cor só ajuda a varrer a lista. */
export function tomDaSituacao(texto: string): Tom {
  const t = texto.normalize('NFD').replace(/\p{Diacritic}/gu, '').toLocaleLowerCase('pt-BR');
  if (/cancel|vencid|estorn|inativ|recus|reprov|falh|erro|desist|expir|bloque|encerrad/.test(t)) return 'negativo';
  if (/aberto|em parte|pendent|analise|aguard|falta|pausad|espera/.test(t)) return 'atencao';
  if (/realizad|confirmad|paga|pago|ativ|aprovad|aceit|enviad|entregu|conclu|particip/.test(t)) return 'positivo';
  if (/agendad|oferecid/.test(t)) return 'marca';
  return 'neutro';
}

const temIcone = (coluna: ColunaRelatorio) => coluna.chave === 'situacao' || coluna.rotulo === 'Situação';
const aDireita = (coluna: ColunaRelatorio) => coluna.tipo === 'moeda' || coluna.tipo === 'numero';
/** Respiro entre um número alinhado à direita e o texto alinhado à esquerda logo depois. */
const recuosDireitos = (colunas: readonly ColunaRelatorio[]) =>
  colunas.map((c, i) => (aDireita(c) && colunas[i + 1] && !aDireita(colunas[i + 1]) ? 10 : 0));

function textoDoPeriodo({ desde, ate }: FiltrosAplicados): string {
  if (desde && ate) return `${dataBr(desde)} a ${dataBr(ate)}`;
  if (desde) return `A partir de ${dataBr(desde)}`;
  if (ate) return `Até ${dataBr(ate)}`;
  return 'Todo o histórico';
}

function itensDoResumo(relatorio: RelatorioDaArea, soma: Map<string, number>) {
  const { area, filtros, linhas } = relatorio;
  const itens: Array<{ rotulo: string; valor: string; peso?: number }> = [{ rotulo: 'Registros', valor: String(linhas.length) }];
  if (area.periodoSobre) itens.push({ rotulo: `Período · ${area.periodoSobre}`, valor: textoDoPeriodo(filtros) });
  for (const coluna of area.colunas) {
    if (soma.has(coluna.chave)) itens.push({ rotulo: `${coluna.rotulo} total`, valor: formatarCelula(soma.get(coluna.chave)!, 'moeda') });
  }
  if (area.filtros.some((f) => f !== 'periodo')) {
    const outros = (Object.entries(filtros) as Array<[keyof FiltrosAplicados, string | undefined]>)
      .filter(([nome, valor]) => valor && nome !== 'desde' && nome !== 'ate')
      .map(([nome, valor]) => `${ROTULO_FILTRO[nome]}: ${valor}`);
    itens.push({ rotulo: 'Filtros', valor: outros.join(' · ') || 'Nenhum', peso: outros.length ? 1.6 : 1 });
  }
  const gerado = new Date(relatorio.geradoEm).toLocaleString('pt-BR', {
    timeZone: 'America/Sao_Paulo', day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit',
  });
  itens.push({ rotulo: 'Gerado em', valor: gerado });
  return itens;
}

function cabecalho(doc: PDFKit.PDFDocument, relatorio: RelatorioDaArea, largura: number): number {
  const y = 30;
  const altura = 92;
  const x = MARGEM + 22;
  doc.roundedRect(MARGEM, y, largura, altura, 18).fill(COR.escuro);
  doc.image(certificateAssets.logoWhite(), x, y + 18, { height: 20 });

  const chip = 'Relatórios por área';
  doc.font(FONTE.semi).fontSize(7.5);
  const larguraChip = doc.widthOfString(chip) + 20;
  const xChip = MARGEM + largura - 22 - larguraChip;
  doc.save().fillOpacity(0.15).roundedRect(xChip, y + 19, larguraChip, 18, 9).fill('#FFFFFF').restore();
  doc.fillColor('#FFFFFF').text(chip, xChip + 10, y + 24.2, { lineBreak: false });

  doc.font(FONTE.negrito).fontSize(19).fillColor('#FFFFFF')
    .text(relatorio.area.titulo, x, y + 46, { width: largura - 44, lineBreak: false });
  doc.save().fillOpacity(0.72).font(FONTE.texto).fontSize(8.5).fillColor('#FFFFFF')
    .text(relatorio.area.descricao, x, y + 71, { width: largura - 44, lineBreak: false, ellipsis: true })
    .restore();
  return y + altura;
}

function cabecalhoDeContinuacao(doc: PDFKit.PDFDocument, relatorio: RelatorioDaArea, largura: number): number {
  doc.font(FONTE.negrito).fontSize(11).fillColor(COR.escuro).text(relatorio.area.titulo, MARGEM, 30, { lineBreak: false });
  doc.font(FONTE.texto).fontSize(7.5).fillColor(COR.suave)
    .text('Viver Mais Psicologia · Relatórios por área · continuação', MARGEM, 32.5, { width: largura, align: 'right', lineBreak: false });
  return 52;
}

function faixaDeResumo(doc: PDFKit.PDFDocument, relatorio: RelatorioDaArea, soma: Map<string, number>, y: number, largura: number): number {
  const itens = itensDoResumo(relatorio, soma);
  const pesoTotal = itens.reduce((n, item) => n + (item.peso ?? 1), 0);
  const larguras = itens.map((item) => (largura * (item.peso ?? 1)) / pesoTotal);
  const padX = 14;
  const padY = 10;
  doc.font(FONTE.negrito).fontSize(10.5);
  const alturaValor = Math.max(...itens.map((item, i) => doc.heightOfString(item.valor, { width: larguras[i] - padX * 2 })));
  const altura = padY * 2 + 13 + alturaValor;
  doc.roundedRect(MARGEM, y, largura, altura, RAIO).fill(COR.faixa);
  let x = MARGEM;
  itens.forEach((item, i) => {
    if (i > 0) doc.moveTo(x, y + padY).lineTo(x, y + altura - padY).lineWidth(0.8).stroke(COR.divisoria);
    doc.font(FONTE.semi).fontSize(7.5).fillColor(COR.suave)
      .text(item.rotulo, x + padX, y + padY, { width: larguras[i] - padX * 2, lineBreak: false, ellipsis: true });
    doc.font(FONTE.negrito).fontSize(10.5).fillColor(COR.tinta)
      .text(item.valor, x + padX, y + padY + 13, { width: larguras[i] - padX * 2, features: ['tnum'] });
    x += larguras[i];
  });
  return y + altura;
}

const OPCOES_TEXTO = { features: ['tnum'] as PDFKit.Mixins.OpenTypeFeatures[] };
const fonteDaCelula = (coluna: ColunaRelatorio) => (coluna.tipo === 'moeda' ? FONTE.semi : FONTE.texto);

/**
 * Largura de cada coluna pelo conteúdo, medido na fonte em que é desenhado
 * (a linha de total, em negrito). Se sobra espaço, um terço se divide entre
 * todas as colunas e o resto vai para as de texto; se falta, só o texto
 * encolhe (e quebra linha) — datas, números e valores mantêm a largura natural.
 */
function largurasDasColunas(
  doc: PDFKit.PDFDocument, colunas: readonly ColunaRelatorio[], celulas: string[][], total: string[] | null, disponivel: number,
): number[] {
  doc.font(FONTE.semi).fontSize(ROTULO);
  const rotulos = colunas.map((c) => doc.widthOfString(c.rotulo));
  const palavras = colunas.map((c) => Math.max(...c.rotulo.split(' ').map((p) => doc.widthOfString(p))));
  const recuos = recuosDireitos(colunas);
  const natural = colunas.map((c, i) => {
    doc.font(fonteDaCelula(c)).fontSize(CORPO);
    let conteudo = celulas.reduce((maior, linha) => Math.max(maior, doc.widthOfString(linha[i], OPCOES_TEXTO)), 0);
    if (total?.[i]) conteudo = Math.max(conteudo, doc.font(FONTE.negrito).fontSize(CORPO).widthOfString(total[i], OPCOES_TEXTO));
    return Math.max(rotulos[i], Math.min(conteudo, 210) + (temIcone(c) ? ICONE : 0)) + PAD_CELULA * 2 + 2 + recuos[i];
  });
  const minimo = natural.map((n, i) => (colunas[i].tipo === 'texto' ? Math.min(n, Math.max(palavras[i] + PAD_CELULA * 2 + 2, 58)) : n));
  const soma = natural.reduce((n, w) => n + w, 0);
  if (soma <= disponivel) {
    const base = natural.reduce((n, w, i) => n + (colunas[i].tipo === 'texto' ? w : 0), 0);
    const sobra = disponivel - soma;
    const igual = base ? sobra / 3 / natural.length : sobra / natural.length;
    return natural.map((w, i) => w + igual + (base && colunas[i].tipo === 'texto' ? ((sobra * 2) / 3) * (w / base) : 0));
  }
  const falta = soma - disponivel;
  const folga = natural.reduce((n, w, i) => n + (w - minimo[i]), 0);
  if (folga >= falta) return natural.map((w, i) => w - (falta * (w - minimo[i])) / folga);
  const somaMinimo = minimo.reduce((n, w) => n + w, 0);
  return minimo.map((w) => (w * disponivel) / somaMinimo);
}

function tabela(doc: PDFKit.PDFDocument, relatorio: RelatorioDaArea, soma: Map<string, number>, yInicial: number, largura: number) {
  const { colunas } = relatorio.area;
  const limite = doc.page.height - 46;
  const celulas = relatorio.linhas.map((linha) => colunas.map((c) => formatarCelula(linha[c.chave], c.tipo)));
  const total = soma.size && celulas.length
    ? colunas.map((c, i) => (i === 0 ? 'Total' : soma.has(c.chave) ? formatarCelula(soma.get(c.chave)!, 'moeda') : ''))
    : null;
  const larguras = largurasDasColunas(doc, colunas, celulas, total, largura - PAD_CARD * 2);
  const xs = larguras.map((_, i) => MARGEM + PAD_CARD + larguras.slice(0, i).reduce((n, w) => n + w, 0));
  const recuos = recuosDireitos(colunas);
  const larguraUtil = (i: number) => larguras[i] - PAD_CELULA * 2 - recuos[i];
  const larguraTexto = (i: number, valor: string) => larguraUtil(i) - (temIcone(colunas[i]) && valor !== '—' ? ICONE : 0);

  let y = yInicial;
  let inicioDoCard = y;
  let primeiraDoCard = true;

  const fecharCard = () => doc.roundedRect(MARGEM, inicioDoCard, largura, y - inicioDoCard, RAIO).lineWidth(0.8).stroke(COR.divisoria);

  const cabecalhoDaTabela = () => {
    inicioDoCard = y;
    primeiraDoCard = true;
    doc.font(FONTE.semi).fontSize(ROTULO);
    const altura = Math.max(...colunas.map((c, i) => doc.heightOfString(c.rotulo, { width: larguraUtil(i) }))) + 14;
    doc.save().roundedRect(MARGEM, y, largura, altura + RAIO * 2, RAIO).clip().rect(MARGEM, y, largura, altura).fill(COR.faixa).restore();
    colunas.forEach((c, i) => {
      doc.font(FONTE.semi).fontSize(ROTULO).fillColor(COR.suave)
        .text(c.rotulo, xs[i] + PAD_CELULA, y + 7, { width: larguraUtil(i), align: aDireita(c) ? 'right' : 'left' });
    });
    y += altura;
  };

  const alturaDaLinha = (valores: string[], negrito: boolean) => Math.max(...valores.map((v, i) => {
    doc.font(negrito ? FONTE.negrito : fonteDaCelula(colunas[i])).fontSize(CORPO);
    return doc.heightOfString(v, { ...OPCOES_TEXTO, width: larguraTexto(i, negrito ? '—' : v) });
  })) + PAD_LINHA * 2;

  const garantirEspaco = (altura: number) => {
    if (y + altura <= limite) return;
    fecharCard();
    doc.addPage();
    y = cabecalhoDeContinuacao(doc, relatorio, largura);
    cabecalhoDaTabela();
  };

  const desenharCelulas = (valores: string[], negrito: boolean) => {
    valores.forEach((valor, i) => {
      const coluna = colunas[i];
      let x = xs[i] + PAD_CELULA;
      if (!negrito && temIcone(coluna) && valor !== '—') {
        doc.circle(x + 2.6, y + PAD_LINHA + 5, 2.4).fill(COR_DO_TOM[tomDaSituacao(valor)]);
        x += ICONE;
      }
      const cor = negrito ? COR.escuro : coluna.tipo === 'texto' || coluna.tipo === 'moeda' ? COR.tinta : COR.suave;
      doc.font(negrito ? FONTE.negrito : fonteDaCelula(coluna)).fontSize(CORPO).fillColor(cor)
        .text(valor, x, y + PAD_LINHA, {
          ...OPCOES_TEXTO, width: larguraTexto(i, negrito ? '—' : valor), align: aDireita(coluna) ? 'right' : 'left',
        });
    });
  };

  cabecalhoDaTabela();

  if (!celulas.length) {
    doc.font(FONTE.texto).fontSize(9).fillColor(COR.suave)
      .text('Nenhum registro com os filtros escolhidos.', MARGEM, y + 16, { width: largura, align: 'center' });
    y += 44;
  }

  for (const valores of celulas) {
    const altura = alturaDaLinha(valores, false);
    garantirEspaco(altura);
    if (!primeiraDoCard) doc.moveTo(MARGEM + PAD_CARD, y).lineTo(MARGEM + largura - PAD_CARD, y).lineWidth(0.6).stroke(COR.linha);
    desenharCelulas(valores, false);
    primeiraDoCard = false;
    y += altura;
  }

  if (total) {
    const altura = alturaDaLinha(total, true) + 2;
    garantirEspaco(altura);
    doc.save().roundedRect(MARGEM, y + altura - RAIO * 4, largura, RAIO * 4, RAIO).clip().rect(MARGEM, y, largura, altura).fill(COR.faixa).restore();
    y += 1;
    desenharCelulas(total, true);
    y += altura - 1;
  }
  fecharCard();
}

function rodapes(doc: PDFKit.PDFDocument, relatorio: RelatorioDaArea, largura: number) {
  const { start, count } = doc.bufferedPageRange();
  for (let pagina = start; pagina < start + count; pagina += 1) {
    doc.switchToPage(pagina);
    const y = doc.page.height - 30;
    doc.moveTo(MARGEM, y - 8).lineTo(MARGEM + largura, y - 8).lineWidth(0.6).stroke(COR.divisoria);
    doc.font(FONTE.texto).fontSize(7).fillColor(COR.suave)
      .text(`Viver Mais Psicologia · Relatório de ${relatorio.area.titulo.toLocaleLowerCase('pt-BR')} · só dados administrativos, sem conteúdo de prontuário`,
        MARGEM, y, { width: largura - 110, lineBreak: false, ellipsis: true });
    doc.text(`Página ${pagina - start + 1} de ${count}`, MARGEM + largura - 110, y, { width: 110, align: 'right', lineBreak: false });
  }
}

async function pdf(relatorio: RelatorioDaArea): Promise<Buffer> {
  const geradoEm = new Date(relatorio.geradoEm);
  const doc = new PDFDocument({
    size: 'A4', layout: 'landscape', bufferPages: true,
    margins: { top: 30, bottom: 10, left: MARGEM, right: MARGEM },
    info: {
      Title: `Relatório de ${relatorio.area.titulo.toLocaleLowerCase('pt-BR')} — Viver Mais Psicologia`,
      Author: 'Viver Mais Psicologia',
      Subject: descricaoDosFiltros(relatorio),
      CreationDate: geradoEm,
      ModDate: geradoEm,
    },
  });
  const chunks: Buffer[] = [];
  const pronto = new Promise<Buffer>((resolve, reject) => {
    doc.on('data', (chunk) => chunks.push(chunk));
    doc.on('error', reject);
    doc.on('end', () => resolve(Buffer.concat(chunks)));
  });
  doc.registerFont(FONTE.texto, certificateAssets.interTight400());
  doc.registerFont(FONTE.semi, certificateAssets.interTight600());
  doc.registerFont(FONTE.negrito, certificateAssets.interTight800());

  const largura = doc.page.width - MARGEM * 2;
  const soma = totais(relatorio);
  const fimDoCabecalho = cabecalho(doc, relatorio, largura);
  const fimDaFaixa = faixaDeResumo(doc, relatorio, soma, fimDoCabecalho + 10, largura);
  tabela(doc, relatorio, soma, fimDaFaixa + 12, largura);
  rodapes(doc, relatorio, largura);
  doc.end();
  return pronto;
}

export async function arquivoDoRelatorio(relatorio: RelatorioDaArea, formato: 'xlsx' | 'pdf'): Promise<Buffer> {
  return formato === 'xlsx' ? planilha(relatorio) : pdf(relatorio);
}
