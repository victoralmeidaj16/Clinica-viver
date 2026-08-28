import { describe, expect, it } from 'vitest';
import { bookingStageIndex, type BookingStep } from './BookingProgress';

describe('indicador do fluxo de agendamento', () => {
  it.each<[BookingStep, number]>([
    ['SERVICOS', 0],
    ['CAMINHO', 1],
    ['MATCH', 2],
    ['MATCH_RECOMENDACOES', 2],
    ['PROFISSIONAIS', 2],
    ['FORMULARIO', 3],
    ['SUCESSO', 3],
  ])('mapeia %s para a etapa visual %i', (step, expectedStage) => {
    expect(bookingStageIndex(step)).toBe(expectedStage);
  });
});
