import { describe, expect, it } from 'vitest';
import { dataHoraSessao, descricaoFiscalDaSessao } from './sessionReference';

describe('referência temporal da sessão', () => {
  it('formata data e hora no fuso da clínica', () => {
    expect(dataHoraSessao('2026-08-21T17:30:00.000Z')).toBe('21/08/2026 às 14:30');
  });

  it('gera a descrição fiscal rastreável do atendimento', () => {
    expect(descricaoFiscalDaSessao('2026-08-21T17:30:00.000Z')).toBe(
      'Atendimento Psicoterápico — sessão em 21/08/2026 às 14:30.'
    );
  });

  it('recusa data inválida', () => {
    expect(() => dataHoraSessao('invalida')).toThrow('Data da sessão inválida');
  });
});
