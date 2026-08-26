import { describe, expect, it } from 'vitest';
import {
  LIMITE_PACIENTES_MAXIMO,
  LIMITE_PACIENTES_MINIMO,
  limitePacientesValido,
} from './psychologistCapacity';

describe('limitePacientesValido', () => {
  it('aceita os extremos da faixa administrativa', () => {
    expect(limitePacientesValido(LIMITE_PACIENTES_MINIMO)).toBe(true);
    expect(limitePacientesValido(LIMITE_PACIENTES_MAXIMO)).toBe(true);
  });

  it('recusa zero, frações, texto e valores acima do teto de segurança', () => {
    expect(limitePacientesValido(0)).toBe(false);
    expect(limitePacientesValido(2.5)).toBe(false);
    expect(limitePacientesValido('10')).toBe(false);
    expect(limitePacientesValido(LIMITE_PACIENTES_MAXIMO + 1)).toBe(false);
  });
});
