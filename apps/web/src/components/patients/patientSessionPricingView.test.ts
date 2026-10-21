import { describe, expect, it } from 'vitest';
import { formatCents, parseReaisToCents } from './patientSessionPricingView';

describe('valor de sessão no painel de gestão', () => {
  it('converte reais brasileiros em centavos sem usar ponto flutuante persistido', () => {
    expect(parseReaisToCents('75')).toBe(7500);
    expect(parseReaisToCents('75,50')).toBe(7550);
    expect(parseReaisToCents('R$ 1.200,00')).toBe(120000);
    expect(parseReaisToCents('0')).toBeNull();
    expect(parseReaisToCents('75,999')).toBeNull();
  });

  it('formata o resumo em BRL', () => {
    expect(formatCents(7500)).toContain('75,00');
  });
});
