import { describe, expect, it } from 'vitest';
import { duracaoCompativelComPublico, publicoColetivo, publicoDaSessao } from './publicoDuracaoSessao';

describe('publicoColetivo', () => {
  it.each(['Casal', 'FAMÍLIA', 'familia', 'Grupo terapêutico', 'Casais'])('%s é coletivo', (publico) => {
    expect(publicoColetivo(publico)).toBe(true);
  });
  it.each(['Adulto', 'Criança', 'Adolescente', '', undefined])('%s não é coletivo', (publico) => {
    expect(publicoColetivo(publico)).toBe(false);
  });
});

describe('publicoDaSessao', () => {
  it('Orientação Parental de 90 min grava Família', () => {
    expect(publicoDaSessao({ serviceKey: 'ORIENTACAO_PARENTAL', duracaoMin: 90, publicoDoVinculo: 'Criança' })).toBe('Família');
  });
  it('Orientação Parental de 50 min grava o público do vínculo', () => {
    expect(publicoDaSessao({ serviceKey: 'ORIENTACAO_PARENTAL', duracaoMin: 50, publicoDoVinculo: 'Criança' })).toBe('Criança');
  });
  it('Psicoterapia de Casal sem público grava Casal', () => {
    expect(publicoDaSessao({ serviceKey: 'PSICOTERAPIA_CASAL', duracaoMin: 90 })).toBe('Casal');
  });
  it('apara e limita o público a 160 caracteres', () => {
    expect(publicoDaSessao({ serviceKey: 'PSICOTERAPIA', duracaoMin: 50, publicoDoVinculo: `  ${'a'.repeat(200)}  ` })).toHaveLength(160);
  });
  it('sem público devolve undefined', () => {
    expect(publicoDaSessao({ serviceKey: 'PSICOTERAPIA', duracaoMin: 50, publicoDoVinculo: '  ' })).toBeUndefined();
  });
});

describe('duracaoCompativelComPublico (§ 14)', () => {
  it.each([
    ['AVALIACAO', 75, 'Adulto', 'manual', true],
    ['AVALIACAO', 300, 'Adulto', 'manual', false],
    ['PSICOTERAPIA_CASAL', 90, undefined, 'link', true],
    ['PSICOTERAPIA_CASAL', 50, 'Casal', 'manual', false],
    ['ORIENTACAO_PARENTAL', 90, 'Família', 'link', true],
    ['ORIENTACAO_PARENTAL', 50, 'Família', 'manual', false],
    ['ORIENTACAO_PARENTAL', 90, 'Criança', 'manual', true],
    ['ORIENTACAO_PARENTAL', 90, 'Criança', 'link', false],
    ['ORIENTACAO_PARENTAL', 50, undefined, 'link', true],
    ['ORIENTACAO_PARENTAL', 90, undefined, 'link', true],
    ['PSICOTERAPIA', 90, 'Grupo', 'link', true],
    ['PSICOTERAPIA', 50, 'Grupo', 'manual', false],
    ['PSICOTERAPIA', 50, 'Adulto', 'manual', true],
    ['PSICOTERAPIA', 90, 'Adulto', 'manual', false],
    ['PSICOTERAPIA', 90, undefined, 'manual', true],
    ['PSICOTERAPIA', 90, undefined, 'link', false],
    ['PSICOTERAPIA', 50, undefined, 'link', true],
    ['ORIENTACAO_VOCACIONAL', 90, 'Grupo', 'link', true],
    ['ORIENTACAO_PROFISSIONAL', 90, 'Adolescente', 'manual', false],
    ['DESCONHECIDO', 50, 'Adulto', 'manual', false],
  ] as const)('%s %i min, público %s, %s → %s', (servico, duracao, publico, origem, esperado) => {
    expect(duracaoCompativelComPublico(servico, duracao, publico, origem)).toBe(esperado);
  });
});
