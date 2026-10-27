import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';
import { VariableDurationFields, variableDurationMinutes } from './VariableDurationFields';

describe('duração variável em horas e minutos', () => {
  it('converte apenas horas e minutos válidos', () => {
    expect(variableDurationMinutes('1', '30')).toBe(90);
    expect(variableDurationMinutes('0', '45')).toBe(45);
    expect(Number.isNaN(variableDurationMinutes('', '30'))).toBe(true);
    expect(Number.isNaN(variableDurationMinutes('1', '60'))).toBe(true);
  });

  it('exibe os dois campos para o profissional', () => {
    const markup = renderToStaticMarkup(<VariableDurationFields hours="1" minutes="30"
      onHoursChange={vi.fn()} onMinutesChange={vi.fn()} />);
    expect(markup).toContain('aria-label="Horas da sessão"');
    expect(markup).toContain('aria-label="Minutos da sessão"');
  });
});
