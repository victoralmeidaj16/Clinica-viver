import { describe, expect, it } from 'vitest';
import fonte from './fixtures/termoAdesaoSource2026_3.json';
import {
  TERMO_ADESAO_CLAUSULAS,
  TERMO_ADESAO_HONORARIOS,
  TERMO_ADESAO_IDENTIFICACAO,
  VERSAO_TERMO_ADESAO,
  TERMO_ADESAO_TITULO,
  TERMO_ADESAO_SUBTITULO,
  TERMO_ADESAO_PAINEL,
  TERMO_ADESAO_HONORARIOS_CABECALHOS,
} from './termoAdesaoContent';

describe('conteúdo do Termo de Adesão', () => {
  it('mantém a estrutura completa do documento aprovado', () => {
    expect(VERSAO_TERMO_ADESAO).toBe('2026.3');
    expect(TERMO_ADESAO_CLAUSULAS).toHaveLength(13);
    expect(TERMO_ADESAO_CLAUSULAS.map((clausula) => clausula.numero)).toEqual([
      '01', '02', '03', '04', '05', '06', '07', '08', '09', '10', '11', '12', '13',
    ]);
  });

  it('preserva todos os parágrafos das cláusulas do DOCX fornecido pela equipe', () => {
    const normalizar = (texto: string) => texto.replace(/\s+/g, ' ').trim();
    let indice = -1;
    const esperados: string[][] = [];
    for (const bloco of fonte) {
      if (bloco.tipo !== 'paragrafo' || !bloco.texto) continue;
      if (bloco.texto.startsWith('CLÁUSULA ')) { esperados.push([]); indice++; }
      else if (indice >= 0) esperados[indice].push(normalizar(bloco.texto));
    }
    expect(TERMO_ADESAO_CLAUSULAS.map((clausula) => clausula.paragrafos.map(normalizar))).toEqual(esperados);
    expect(TERMO_ADESAO_TITULO).toBe(fonte[0].texto);
    expect(TERMO_ADESAO_SUBTITULO).toBe(fonte[1].texto);
    expect(TERMO_ADESAO_IDENTIFICACAO).toEqual([fonte[2].texto, fonte[3].linhas?.[0][0]]);
    const tabelas = fonte.filter((bloco) => bloco.tipo === 'tabela');
    expect(TERMO_ADESAO_HONORARIOS_CABECALHOS).toEqual(tabelas[1].linhas?.[0]);
    expect(TERMO_ADESAO_HONORARIOS.map((linha) => [linha.servico, linha.particular, linha.social, linha.pacoteSocial, linha.pacoteParticular]))
      .toEqual(tabelas[1].linhas?.slice(1));
    expect(TERMO_ADESAO_PAINEL).toEqual(tabelas[2].linhas?.flat());
  });

  it('preserva os pontos essenciais do aceite eletrônico', () => {
    const texto = TERMO_ADESAO_CLAUSULAS.flatMap((clausula) => clausula.paragrafos).join(' ');

    expect(texto).toContain('Lei nº 13.709/2018');
    expect(texto).toContain('MP 2.200-2/2001');
    expect(texto).toContain('IP de conexão, data, hora');
    expect(texto).toContain('novo **aceite eletrônico**');
  });

  it('mantém todos os honorários do documento', () => {
    expect(TERMO_ADESAO_HONORARIOS).toHaveLength(4);
    expect(TERMO_ADESAO_HONORARIOS).toContainEqual({
      servico: 'Avaliação Psicológica / Neuropsicológica',
      particular: 'R$ 150,00',
      social: 'R$ 100,00',
      pacoteSocial: '10% de desconto',
      pacoteParticular: '10% de desconto',
    });
  });
});
