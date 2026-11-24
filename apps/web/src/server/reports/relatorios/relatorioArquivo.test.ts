import { describe, expect, it, vi } from 'vitest';

vi.mock('server-only', () => ({}));

import { areaRelatorio, contemTermo, dentroDoPeriodo, formatarCelula } from '@/lib/relatorios/areas';
import { arquivoDoRelatorio, descricaoDosFiltros } from './relatorioArquivo';
import { filtrosDaUrl, type RelatorioDaArea } from './relatoriosArea';

const relatorio: RelatorioDaArea = {
  area: areaRelatorio('financeiro')!,
  filtros: { desde: '2026-11-01', ate: '2026-11-30', profissional: 'Fictícia' },
  geradoEm: '2026-11-24T15:00:00.000Z',
  linhas: [
    { vencimento: '2026-11-10T13:00:00.000Z', paciente: 'Paciente fictício', profissional: 'Psicóloga Fictícia',
      situacao: 'Paga', pagador: 'Paciente', valor: 120, recebido: 120, referencia: 'cob-1' },
    { vencimento: '2026-11-20T13:00:00.000Z', paciente: 'Outro fictício', profissional: 'Psicóloga Fictícia',
      situacao: 'Em aberto', pagador: 'Empresa', valor: 90.5, recebido: 0, referencia: 'cob-2' },
  ],
};

describe('exportação dos relatórios por área', () => {
  it('gera uma planilha .xlsx (zip) e um PDF', async () => {
    const xlsx = await arquivoDoRelatorio(relatorio, 'xlsx');
    expect(xlsx.subarray(0, 2).toString()).toBe('PK');
    const pdf = await arquivoDoRelatorio(relatorio, 'pdf');
    expect(pdf.subarray(0, 5).toString()).toBe('%PDF-');
  });

  it('gera os arquivos também sem linhas', async () => {
    const vazio = { ...relatorio, linhas: [] };
    await expect(arquivoDoRelatorio(vazio, 'pdf')).resolves.toBeInstanceOf(Buffer);
    await expect(arquivoDoRelatorio(vazio, 'xlsx')).resolves.toBeInstanceOf(Buffer);
  });

  it('descreve os filtros e o que o período considera', () => {
    expect(descricaoDosFiltros(relatorio)).toBe('De: 01/11/2026 · Até: 30/11/2026 · Psicólogo: Fictícia (o período considera: vencimento)');
  });
});

describe('filtros da URL', () => {
  it('descarta filtros que a área não aceita', () => {
    const area = areaRelatorio('convenios')!;
    expect(filtrosDaUrl(area, new URLSearchParams('empresa=ACME&profissional=X&desde=2026-01-01'))).toEqual({ empresa: 'ACME' });
  });

  it('recusa período invertido ou data inválida', () => {
    const area = areaRelatorio('agendamentos')!;
    expect(() => filtrosDaUrl(area, new URLSearchParams('desde=2026-12-01&ate=2026-11-01'))).toThrow('posterior');
    expect(() => filtrosDaUrl(area, new URLSearchParams('desde=01/11/2026'))).toThrow('inválida');
  });
});

describe('utilitários', () => {
  it('compara texto sem acento e sem maiúscula', () => {
    expect(contemTermo('Psicóloga Fictícia', 'ficticia')).toBe(true);
    expect(contemTermo('Ana', 'Bia')).toBe(false);
    expect(contemTermo(null, undefined)).toBe(true);
  });

  it('usa a data de Brasília para o período', () => {
    // 02:00 UTC de 1º/12 ainda é 30/11 em Brasília.
    expect(dentroDoPeriodo('2026-12-01T02:00:00.000Z', '2026-11-01', '2026-11-30')).toBe(true);
    expect(dentroDoPeriodo(null, '2026-11-01')).toBe(false);
  });

  it('formata moeda e data', () => {
    expect(formatarCelula(90.5, 'moeda')).toBe('R$ 90,50');
    expect(formatarCelula('2026-11-05', 'data')).toBe('05/11/2026');
    expect(formatarCelula(null, 'texto')).toBe('—');
  });
});
