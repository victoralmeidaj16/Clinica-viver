import { describe, expect, it } from 'vitest';
import { periodoPadrao } from './periodo';

/**
 * O período de faturamento é do componente pai justamente porque o painel que o
 * edita some da árvore enquanto o detalhe recarrega. Este módulo é o valor
 * inicial compartilhado entre a página, o filtro enviado à API e o formulário.
 */
describe('periodoPadrao', () => {
  it('vai do primeiro dia do mês corrente até hoje', () => {
    expect(periodoPadrao(new Date(2026, 8, 8, 15, 30))).toEqual({
      inicio: '2026-09-01',
      fim: '2026-09-08',
    });
  });

  it('usa a data local, sem deslocar o dia pelo fuso', () => {
    // 31/08 às 22h em São Paulo ainda é agosto; convertido para UTC viraria
    // setembro e o período nasceria fora da competência que o usuário vê.
    expect(periodoPadrao(new Date(2026, 7, 31, 22, 0))).toEqual({
      inicio: '2026-08-01',
      fim: '2026-08-31',
    });
  });
});
