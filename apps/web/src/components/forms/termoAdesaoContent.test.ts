import { describe, expect, it } from 'vitest';
import {
  TERMO_ADESAO_CLAUSULAS,
  TERMO_ADESAO_HONORARIOS,
  TERMO_ADESAO_IDENTIFICACAO,
  VERSAO_TERMO_ADESAO,
} from './termoAdesaoContent';

describe('conteúdo do Termo de Adesão', () => {
  it('mantém a estrutura completa do documento aprovado', () => {
    expect(VERSAO_TERMO_ADESAO).toBe('2026.2');
    expect(TERMO_ADESAO_IDENTIFICACAO).toHaveLength(3);
    expect(TERMO_ADESAO_CLAUSULAS).toHaveLength(13);
    expect(TERMO_ADESAO_CLAUSULAS.map((clausula) => clausula.numero)).toEqual([
      '01', '02', '03', '04', '05', '06', '07', '08', '09', '10', '11', '12', '13',
    ]);
  });

  it('preserva os pontos essenciais do aceite eletrônico', () => {
    const texto = TERMO_ADESAO_CLAUSULAS.flatMap((clausula) => clausula.paragrafos).join(' ');

    expect(texto).toContain('Lei nº 13.709/2018');
    expect(texto).toContain('MP 2.200-2/2001');
    expect(texto).toContain('IP de conexão, data, hora');
    expect(texto).toContain('novo aceite eletrônico');
  });

  it('mantém todos os honorários do documento', () => {
    expect(TERMO_ADESAO_HONORARIOS).toHaveLength(4);
    expect(TERMO_ADESAO_HONORARIOS).toContainEqual({
      servico: 'Avaliação Psicológica / Neuropsicológica',
      particular: 'R$ 150,00',
      social: 'R$ 100,00',
    });
  });
});
