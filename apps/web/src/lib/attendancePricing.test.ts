import { describe, expect, it } from 'vitest';
import { attendancePriceLabel, resolveAttendancePricing } from './attendancePricing';

describe('catálogo compartilhado de preços', () => {
  it.each([
    ['PSICOTERAPIA', 'SOCIAL', 7_500],
    ['PSICOTERAPIA', 'PARTICULAR', 13_000],
    ['PSICOTERAPIA_CASAL', 'CASAL_SOCIAL', 15_000],
    ['PSICOTERAPIA_CASAL', 'CASAL_PARTICULAR', 26_000],
    ['AVALIACAO', 'SOCIAL', 10_000],
    ['AVALIACAO', 'PARTICULAR', 15_000],
    ['ORIENTACAO_PROFISSIONAL', 'SOCIAL', 7_500],
    ['ORIENTACAO_PROFISSIONAL', 'PARTICULAR', 13_000],
    ['ORIENTACAO_PARENTAL', 'SOCIAL', 7_500],
    ['ORIENTACAO_PARENTAL', 'PARTICULAR', 13_000],
    ['ORIENTACAO_PARENTAL', 'FAMILIA_SOCIAL', 15_000],
    ['ORIENTACAO_PARENTAL', 'FAMILIA_PARTICULAR', 23_000],
  ])('%s / %s custa %i centavos', (service, modality, amountCents) => {
    expect(resolveAttendancePricing(service, modality).amountCents).toBe(amountCents);
  });

  it('normaliza modalidade e reconhece o nome por extenso da avaliação', () => {
    expect(attendancePriceLabel('Avaliação Psicológica', ' particular ')).toBe('R$ 150,00');
  });
});
