import { describe, expect, it } from 'vitest';
import { normalizarTurnoPreferencia, normalizarTurnosPreferencia, rotuloTurnoPreferencia } from './turnos';

describe('vocabulário de turnos', () => {
  it.each([
    ['MATUTINO', 'MANHA'], ['Manhã', 'MANHA'],
    ['VESPERTINO', 'TARDE'], ['tarde', 'TARDE'],
    ['NOTURNO', 'NOITE'], ['noite', 'NOITE'],
  ] as const)('normaliza %s para %s', (entrada, esperado) => {
    expect(normalizarTurnoPreferencia(entrada)).toBe(esperado);
  });

  it('não cria correspondência para valores desconhecidos', () => {
    expect(normalizarTurnoPreferencia('madrugada')).toBeNull();
    expect(normalizarTurnoPreferencia(undefined)).toBeNull();
  });

  it('apresenta o rótulo humano das opções canônicas e históricas', () => {
    expect(rotuloTurnoPreferencia('MANHA')).toBe('Manhã');
    expect(rotuloTurnoPreferencia('VESPERTINO')).toBe('Tarde');
  });
});

it('preserva múltiplos períodos sem duplicatas e apresenta todos os rótulos', () => {
  expect(normalizarTurnosPreferencia(['NOITE', 'Manhã', 'MANHA'])).toEqual(['MANHA', 'NOITE']);
  expect(normalizarTurnosPreferencia('MANHA,NOITE')).toEqual(['MANHA', 'NOITE']);
  expect(rotuloTurnoPreferencia('MANHA,NOITE')).toBe('Manhã, Noite');
  expect(normalizarTurnosPreferencia('MANHA,madrugada')).toEqual([]);
});
