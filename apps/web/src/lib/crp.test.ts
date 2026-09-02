import { describe, expect, it } from 'vitest';
import { maskCrpInput, normalizeCrp } from './crp';

describe('maskCrpInput', () => {
  it('retorna string vazia para entrada vazia', () => {
    expect(maskCrpInput('')).toBe('');
  });

  it('mantém até 2 dígitos sem barra', () => {
    expect(maskCrpInput('1')).toBe('1');
    expect(maskCrpInput('12')).toBe('12');
  });

  it('adiciona a barra automaticamente a partir do 3º dígito', () => {
    expect(maskCrpInput('123')).toBe('12/3');
    expect(maskCrpInput('1234')).toBe('12/34');
    expect(maskCrpInput('12345')).toBe('12/345');
    expect(maskCrpInput('123456')).toBe('12/3456');
    expect(maskCrpInput('1234567')).toBe('12/34567');
    expect(maskCrpInput('06148293')).toBe('06/148293');
  });

  it('limpa caracteres não numéricos e texto como prefixo "CRP"', () => {
    expect(maskCrpInput('CRP 07/12345')).toBe('07/12345');
    expect(maskCrpInput('CRP-12.34567')).toBe('12/34567');
  });

  it('limita o tamanho máximo de dígitos', () => {
    expect(maskCrpInput('1234567890123')).toBe('12/3456789');
  });
});

describe('normalizeCrp', () => {
  it('normaliza registros com dígitos suficientes', () => {
    expect(normalizeCrp('1234567')).toBe('12/34567');
    expect(normalizeCrp('CRP 06/123456')).toBe('06/123456');
  });
});
