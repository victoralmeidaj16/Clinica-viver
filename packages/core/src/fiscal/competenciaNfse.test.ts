import { describe, expect, it } from 'vitest';
import { competenciaNfseDoAtendimento } from './competenciaNfse';

describe('competência fiscal do atendimento', () => {
  it('usa a data local de São Paulo, não o dia UTC', () => {
    expect(competenciaNfseDoAtendimento('2026-08-14T01:30:00.000Z')).toBe('2026-08-13');
  });

  it('mantém a data de um atendimento durante o dia', () => {
    expect(competenciaNfseDoAtendimento('2026-08-14T15:00:00.000Z')).toBe('2026-08-14');
  });

  it('recusa uma data inválida', () => {
    expect(() => competenciaNfseDoAtendimento('data-inválida')).toThrow('data ISO válida');
  });
});
