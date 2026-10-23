import { describe, expect, it } from 'vitest';
import {
  ajustarPublicoVitrineAtual,
  opcoesPublicoVitrine,
  publicoVitrinePermitido,
} from './vitrinePublico';

describe('públicos permitidos na vitrine', () => {
  it('expõe a matriz aprovada por serviço e modalidade', () => {
    expect(opcoesPublicoVitrine('AVALIACAO', 'SOCIAL')).toEqual([
      'Individual',
      'Infantil',
      'Adolescente',
    ]);
    expect(opcoesPublicoVitrine('PSICOTERAPIA_CASAL', 'CASAL_PARTICULAR')).toEqual(['Casal']);
    expect(opcoesPublicoVitrine('ORIENTACAO_PARENTAL', 'FAMILIA_SOCIAL')).toEqual(['Família']);
    expect(opcoesPublicoVitrine('ORIENTACAO_PARENTAL', 'PARTICULAR')).toEqual(['Individual']);
    expect(opcoesPublicoVitrine('PSICOTERAPIA', 'SOCIAL')).toEqual([
      'Individual',
      'Infantil',
      'Adolescente',
      'Outro',
    ]);
    expect(opcoesPublicoVitrine('ORIENTACAO_PROFISSIONAL', 'PARTICULAR')).toEqual([
      'Individual',
      'Infantil',
      'Adolescente',
      'Outro',
    ]);
  });

  it('valida rótulos e descrições de Outro sem aceitar chaves desconhecidas', () => {
    expect(publicoVitrinePermitido('PSICOTERAPIA', 'SOCIAL', 'Outro: gestante')).toBe(true);
    expect(publicoVitrinePermitido('AVALIACAO', 'SOCIAL', 'Outro: gestante')).toBe(false);
    expect(publicoVitrinePermitido('AVALIACAO', 'SOCIAL', 'Casal')).toBe(false);
    expect(publicoVitrinePermitido('DESCONHECIDO', 'SOCIAL', 'Individual')).toBe(false);
    expect(publicoVitrinePermitido('AVALIACAO', undefined, 'Individual')).toBe(false);
  });

  it('mantém, preenche ou limpa a escolha ao trocar serviço e modalidade', () => {
    expect(ajustarPublicoVitrineAtual('AVALIACAO', 'SOCIAL', 'Infantil')).toBe('Infantil');
    expect(ajustarPublicoVitrineAtual('PSICOTERAPIA_CASAL', 'CASAL_SOCIAL', 'Individual')).toBe('Casal');
    expect(ajustarPublicoVitrineAtual('ORIENTACAO_PARENTAL', 'FAMILIA_PARTICULAR', '')).toBe('Família');
    expect(ajustarPublicoVitrineAtual('AVALIACAO', 'SOCIAL', 'Casal')).toBe('');
  });
});
