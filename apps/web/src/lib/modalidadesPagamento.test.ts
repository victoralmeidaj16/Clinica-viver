import { describe, expect, it } from 'vitest';
import { permiteNovoPagamento, rotuloFormaPagamento } from './modalidadesPagamento';

describe('rotuloFormaPagamento', () => {
  it.each([
    ['pix', 'Pix'],
    ['card', 'Cartão de crédito/débito'],
    ['boleto', 'Boleto'],
    ['cash', 'Dinheiro'],
    ['bank_transfer', 'Transferência bancária'],
    ['other', 'Outro'],
  ])('traduz %s para %s', (forma, rotulo) => {
    expect(rotuloFormaPagamento(forma)).toBe(rotulo);
  });
});

describe('permiteNovoPagamento', () => {
  it.each(['paid', 'refunded', 'cancelled'])('bloqueia ações para cobrança %s', (status) => {
    expect(permiteNovoPagamento(status)).toBe(false);
  });

  it.each(['draft', 'pending', 'partially_paid', 'overdue', undefined])(
    'mantém ações para cobrança %s',
    (status) => {
      expect(permiteNovoPagamento(status)).toBe(true);
    }
  );
});
