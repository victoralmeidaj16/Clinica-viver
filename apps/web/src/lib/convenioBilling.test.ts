import { describe, expect, it } from 'vitest';
import { normalizarCicloCusteio } from './convenioBilling';

describe('normalizarCicloCusteio', () => {
  it('reconhece os dois ciclos e descarta o resto', () => {
    expect(normalizarCicloCusteio('mensal')).toBe('mensal');
    expect(normalizarCicloCusteio('total')).toBe('total');
    expect(normalizarCicloCusteio('anual')).toBeNull();
    expect(normalizarCicloCusteio(undefined)).toBeNull();
  });
});
