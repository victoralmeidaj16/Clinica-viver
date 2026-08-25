import { describe, expect, it } from 'vitest';
import { ratearFatura, resolveCusteio } from '@/lib/convenioBilling';

describe('custeio de convênio', () => {
  it('herda a política da empresa somente quando a exceção do paciente é nula', () => {
    expect(resolveCusteio(null, 1)).toBe(true);
    expect(resolveCusteio(undefined, 0)).toBe(false);
    expect(resolveCusteio(0, 1)).toBe(false);
    expect(resolveCusteio(1, 0)).toBe(true);
  });
});

describe('rateio da fatura de convênio', () => {
  it('distribui proporcionalmente e põe o resto da divisão na última sessão', () => {
    const parts = ratearFatura(10_001, [3_333, 3_333, 3_334]);
    expect(parts).toEqual([3_333, 3_333, 3_335]);
    expect(parts.reduce((sum, value) => sum + value, 0)).toBe(10_001);
  });

  it('fecha exatamente ao centavo em valores não divisíveis', () => {
    const parts = ratearFatura(100, [1, 1, 1]);
    expect(parts).toEqual([33, 33, 34]);
    expect(parts.reduce((sum, value) => sum + value, 0)).toBe(100);
  });
});
