import 'server-only';

import PDFDocument from 'pdfkit';
import writeExcelFile, { type SheetData } from 'write-excel-file/node';
import { formatarCelula, type ColunaRelatorio, type FiltrosAplicados } from '@/lib/relatorios/areas';
import type { RelatorioDaArea } from './relatoriosArea';

/**
 * Exportação Excel (.xlsx) e PDF de qualquer área (13.05). Números e valores
 * vão como número na planilha, para somar e filtrar no Excel; datas, já no
 * fuso da clínica.
 */

const ROTULO_FILTRO: Record<keyof FiltrosAplicados, string> = {
  desde: 'De', ate: 'Até', profissional: 'Psicólogo', paciente: 'Paciente', curso: 'Curso', turma: 'Turma', empresa: 'Empresa', modulo: 'Módulo',
};

export function descricaoDosFiltros(relatorio: RelatorioDaArea): string {
  const partes = (Object.entries(relatorio.filtros) as Array<[keyof FiltrosAplicados, string | undefined]>)
    .filter(([, valor]) => Boolean(valor))
    .map(([nome, valor]) => `${ROTULO_FILTRO[nome]}: ${nome === 'desde' || nome === 'ate' ? valor!.split('-').reverse().join('/') : valor}`);
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

async function pdf(relatorio: RelatorioDaArea): Promise<Buffer> {
  const doc = new PDFDocument({ size: 'A4', layout: 'landscape', margin: 32 });
  const chunks: Buffer[] = [];
  const pronto = new Promise<Buffer>((resolve, reject) => {
    doc.on('data', (chunk) => chunks.push(chunk));
    doc.on('error', reject);
    doc.on('end', () => resolve(Buffer.concat(chunks)));
  });
  const { colunas } = relatorio.area;
  const largura = doc.page.width - 64;
  const pesos = colunas.map((c) => (c.tipo === 'texto' ? 2 : 1.2));
  const larguras = pesos.map((p) => (p / pesos.reduce((a, b) => a + b, 0)) * largura);
  const gerado = new Date(relatorio.geradoEm).toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo' });

  doc.fontSize(15).font('Helvetica-Bold').text(`Viver Mais Psicologia — ${relatorio.area.titulo}`);
  doc.fontSize(8.5).font('Helvetica').fillColor('#555')
    .text(`${descricaoDosFiltros(relatorio)} · ${relatorio.linhas.length} registro(s) · gerado em ${gerado} · sem conteúdo de prontuário`);
  doc.fillColor('#000').moveDown(0.6);

  const linhaDaTabela = (valores: string[], negrito = false) => {
    doc.font(negrito ? 'Helvetica-Bold' : 'Helvetica').fontSize(7.5);
    const altura = Math.max(...valores.map((v, i) => doc.heightOfString(v, { width: larguras[i] - 4 }))) + 4;
    if (doc.y + altura > doc.page.height - 32) {
      doc.addPage();
      if (!negrito) linhaDaTabela(colunas.map((c) => c.rotulo), true);
    }
    const y = doc.y;
    let x = 32;
    valores.forEach((valor, i) => {
      doc.text(valor, x + 2, y + 2, { width: larguras[i] - 4 });
      x += larguras[i];
    });
    doc.moveTo(32, y + altura).lineTo(32 + largura, y + altura).strokeColor('#ddd').lineWidth(0.5).stroke();
    doc.x = 32;
    doc.y = y + altura;
  };

  linhaDaTabela(colunas.map((c) => c.rotulo), true);
  if (!relatorio.linhas.length) doc.font('Helvetica').fontSize(9).text('Nenhum registro com os filtros escolhidos.', 34, doc.y + 6);
  for (const linha of relatorio.linhas) linhaDaTabela(colunas.map((c) => formatarCelula(linha[c.chave], c.tipo)));
  const soma = totais(relatorio);
  if (soma.size && relatorio.linhas.length) {
    linhaDaTabela(colunas.map((c, i) => (i === 0 ? 'Total' : soma.has(c.chave) ? formatarCelula(soma.get(c.chave)!, 'moeda') : '')), true);
  }
  doc.end();
  return pronto;
}

export async function arquivoDoRelatorio(relatorio: RelatorioDaArea, formato: 'xlsx' | 'pdf'): Promise<Buffer> {
  return formato === 'xlsx' ? planilha(relatorio) : pdf(relatorio);
}
