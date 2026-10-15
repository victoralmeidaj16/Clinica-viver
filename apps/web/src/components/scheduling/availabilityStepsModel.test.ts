import { describe, expect, it } from 'vitest';
import type { JanelaEditavel } from './availabilityEditorModel';
import {
  configDaGrade, erroDaConfig, gradeDaConfig, horariosDoDia, rotuloDias, rotuloDuracao,
} from './availabilityStepsModel';

const janela = (diaSemana: number, horaInicio: string, horaFim: string, extra: Partial<JanelaEditavel> = {}): JanelaEditavel => ({
  diaSemana, horaInicio, horaFim, duracaoMin: 50, modalidade: 'online', ...extra,
});

describe('availabilityStepsModel', () => {
  it('lê uma grade igual em todos os dias como uma regra só', () => {
    const grade = [1, 3, 5].flatMap((dia) => [janela(dia, '08:00', '12:00'), janela(dia, '18:00', '22:00')]);
    const { config, uniforme } = configDaGrade(grade);
    expect(uniforme).toBe(true);
    expect(config.dias).toEqual([1, 3, 5]);
    expect(config.periodos).toEqual([{ horaInicio: '08:00', horaFim: '12:00' }, { horaInicio: '18:00', horaFim: '22:00' }]);
    expect(gradeDaConfig(config)).toEqual(grade.sort((a, b) => a.diaSemana - b.diaSemana || a.horaInicio.localeCompare(b.horaInicio)));
  });

  it('avisa quando os dias têm horários diferentes e parte do primeiro dia da semana', () => {
    const { config, uniforme } = configDaGrade([janela(0, '09:00', '11:00'), janela(2, '14:00', '18:00', { duracaoMin: 60 })]);
    expect(uniforme).toBe(false);
    expect(config.dias).toEqual([2, 0]);
    expect(config.periodos).toEqual([{ horaInicio: '14:00', horaFim: '18:00' }]);
    expect(config.duracaoMin).toBe(60);
  });

  it('começa de segunda a sexta quando ainda não há grade', () => {
    expect(configDaGrade([]).config.dias).toEqual([1, 2, 3, 4, 5]);
  });

  it('gera os horários do dia em sequência, como o link do paciente', () => {
    expect(horariosDoDia({ dias: [1], periodos: [{ horaInicio: '18:00', horaFim: '22:00' }], duracaoMin: 50, modalidade: 'online' }))
      .toEqual(['18:00', '18:50', '19:40', '20:30']);
  });

  it('recusa período invertido ou sobreposto', () => {
    const base = { dias: [1], duracaoMin: 50, modalidade: 'online' as const };
    expect(erroDaConfig({ ...base, periodos: [{ horaInicio: '12:00', horaFim: '08:00' }] })).toMatch(/posterior/);
    expect(erroDaConfig({ ...base, periodos: [{ horaInicio: '08:00', horaFim: '12:00' }, { horaInicio: '11:00', horaFim: '14:00' }] })).toMatch(/sobrepõem/);
    expect(erroDaConfig({ ...base, periodos: [{ horaInicio: '08:00', horaFim: '12:00' }] })).toBeUndefined();
  });

  it('descreve os dias e a duração em português', () => {
    expect(rotuloDias([1, 2, 3, 4, 5])).toBe('Segunda a sexta');
    expect(rotuloDias([4])).toBe('Quinta-feira');
    expect(rotuloDias([0, 1, 6])).toBe('Segunda, Sábado e Domingo');
    expect(rotuloDuracao(50)).toBe('50 min');
    expect(rotuloDuracao(90)).toBe('1h30min');
  });
});
