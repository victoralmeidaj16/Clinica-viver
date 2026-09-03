import { describe, expect, it } from 'vitest';
import { cleanCpf, maskCpf, validCpf } from './cpf';

describe('utilitário de CPF', () => {
  describe('validCpf', () => {
    it('aceita CPFs matematicamente válidos com e sem pontuação', () => {
      expect(validCpf('529.982.247-25')).toBe(true);
      expect(validCpf('52998224725')).toBe(true);
      expect(validCpf('000.000.001-91')).toBe(true);
    });

    it('rejeita valores nulos, vazios ou incompletos', () => {
      expect(validCpf('')).toBe(false);
      expect(validCpf(null)).toBe(false);
      expect(validCpf(undefined)).toBe(false);
      expect(validCpf('123.456')).toBe(false);
      expect(validCpf('1234567890')).toBe(false);
      expect(validCpf('123456789012')).toBe(false);
    });

    it('rejeita CPFs com todos os dígitos iguais mesmo tendo 11 dígitos', () => {
      expect(validCpf('000.000.000-00')).toBe(false);
      expect(validCpf('111.111.111-11')).toBe(false);
      expect(validCpf('222.222.222-22')).toBe(false);
      expect(validCpf('333.333.333-33')).toBe(false);
      expect(validCpf('444.444.444-44')).toBe(false);
      expect(validCpf('555.555.555-55')).toBe(false);
      expect(validCpf('666.666.666-66')).toBe(false);
      expect(validCpf('777.777.777-77')).toBe(false);
      expect(validCpf('888.888.888-88')).toBe(false);
      expect(validCpf('999.999.999-99')).toBe(false);
    });

    it('rejeita CPFs com primeiro dígito verificador incorreto', () => {
      // 529982247-25 é válido, alteramos para 529982247-35
      expect(validCpf('529.982.247-35')).toBe(false);
    });

    it('rejeita CPFs com segundo dígito verificador incorreto', () => {
      // 529982247-25 é válido, alteramos para 529982247-26
      expect(validCpf('529.982.247-26')).toBe(false);
    });

    it('rejeita CPFs fictícios sequenciais comuns', () => {
      expect(validCpf('123.456.789-00')).toBe(false);
      expect(validCpf('12345678901')).toBe(false);
    });
  });

  describe('cleanCpf', () => {
    it('extrai apenas números até o limite de 11 dígitos', () => {
      expect(cleanCpf('529.982.247-25')).toBe('52998224725');
      expect(cleanCpf('abc 123 def 456')).toBe('123456');
      expect(cleanCpf('123456789012345')).toBe('12345678901');
      expect(cleanCpf(null)).toBe('');
    });
  });

  describe('maskCpf', () => {
    it('formata progressivamente e aplica pontuação canônica', () => {
      expect(maskCpf('1')).toBe('1');
      expect(maskCpf('123')).toBe('123');
      expect(maskCpf('1234')).toBe('123.4');
      expect(maskCpf('123456')).toBe('123.456');
      expect(maskCpf('1234567')).toBe('123.456.7');
      expect(maskCpf('123456789')).toBe('123.456.789');
      expect(maskCpf('1234567890')).toBe('123.456.789-0');
      expect(maskCpf('52998224725')).toBe('529.982.247-25');
    });

    it('ignora caracteres não numéricos já existentes na entrada', () => {
      expect(maskCpf('529.982.247-25')).toBe('529.982.247-25');
      expect(maskCpf('529--982..24725')).toBe('529.982.247-25');
    });
  });
});
