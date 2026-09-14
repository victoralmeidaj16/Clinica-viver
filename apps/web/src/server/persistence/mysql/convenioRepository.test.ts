import { describe, expect, it } from 'vitest';
import { ratearFatura } from '@/lib/convenioBilling';

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
