import { describe, expect, it } from 'vitest';
import { formatarTempoDecorrido } from './tempoDecorrido';

describe('formatarTempoDecorrido', () => {
  it('devolve traço quando não há tempo decorrido', () => {
    expect(formatarTempoDecorrido(null)).toBe('—');
    expect(formatarTempoDecorrido(undefined)).toBe('—');
    expect(formatarTempoDecorrido(Number.NaN)).toBe('—');
  });

  it('mostra minutos antes de completar uma hora', () => {
    expect(formatarTempoDecorrido(0)).toBe('< 1 min');
    expect(formatarTempoDecorrido(0.5)).toBe('30 min');
    expect(formatarTempoDecorrido(0.999)).toBe('1h');
  });

  it('mostra horas e minutos dentro da janela de 24h', () => {
    expect(formatarTempoDecorrido(2)).toBe('2h');
    expect(formatarTempoDecorrido(2.5)).toBe('2h 30min');
    expect(formatarTempoDecorrido(23.999)).toBe('1 dia');
  });

  it('converte horas acumuladas acima de 24h em dias e horas', () => {
    expect(formatarTempoDecorrido(24)).toBe('1 dia');
    expect(formatarTempoDecorrido(26)).toBe('1 dia e 2h');
    expect(formatarTempoDecorrido(48)).toBe('2 dias');
    expect(formatarTempoDecorrido(482.7)).toBe('20 dias e 2h');
  });
});
