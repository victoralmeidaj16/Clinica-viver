import { describe, expect, it } from 'vitest';
import {
  CLINICAL_SERVICES,
  clinicDateTimeToIso,
  civilDaysBetween,
  getServiceDuration,
  hasVariableDuration,
  manualAppointmentTimes,
  monthlyRecurrenceDates,
  shiftCivilDate,
  todayAtClinic,
} from './manualAppointment';

describe('agendamento manual no fuso da clínica', () => {
  it('converte a hora de Brasília em instante absoluto', () => {
    expect(clinicDateTimeToIso('2026-08-21', '14:30')).toBe('2026-08-21T17:30:00.000Z');
  });

  it('calcula o término a partir da duração escolhida', () => {
    expect(manualAppointmentTimes({ date: '2026-08-21', time: '14:30', durationMinutes: 50 }))
      .toEqual({ startsAt: '2026-08-21T17:30:00.000Z', endsAt: '2026-08-21T18:20:00.000Z' });
  });

  it('retorna a duração correta conforme o serviço clínico selecionado', () => {
    expect(getServiceDuration('PSICOTERAPIA')).toBe(50);
    expect(getServiceDuration('AVALIACAO')).toBe(50);
    expect(getServiceDuration('ORIENTACAO_PARENTAL')).toBe(50);
    expect(getServiceDuration('ORIENTACAO_PROFISSIONAL')).toBe(50);
    expect(getServiceDuration('PSICOTERAPIA_CASAL')).toBe(90);
    expect(getServiceDuration('OUTRO_DESCONHECIDO')).toBe(50);
  });

  it('só a avaliação tem duração informada pelo profissional', () => {
    expect(hasVariableDuration('AVALIACAO')).toBe(true);
    expect(hasVariableDuration('PSICOTERAPIA')).toBe(false);
    expect(hasVariableDuration('PSICOTERAPIA_CASAL')).toBe(false);
    expect(hasVariableDuration('OUTRO_DESCONHECIDO')).toBe(false);
  });

  it('contém a lista esperada de serviços clínicos', () => {
    const keys = CLINICAL_SERVICES.map((s) => s.key);
    expect(keys).toContain('PSICOTERAPIA');
    expect(keys).toContain('AVALIACAO');
    expect(keys).toContain('ORIENTACAO_PARENTAL');
    expect(keys).toContain('ORIENTACAO_PROFISSIONAL');
    expect(keys).toContain('PSICOTERAPIA_CASAL');
  });

  it('usa o dia civil de São Paulo', () => {
    expect(todayAtClinic(new Date('2026-08-22T01:30:00.000Z'))).toBe('2026-08-21');
  });

  it('gera todas as sessões semanais restantes no mesmo mês', () => {
    expect(monthlyRecurrenceDates('2026-09-08', 'weekly')).toEqual([
      '2026-09-08', '2026-09-15', '2026-09-22', '2026-09-29',
    ]);
  });

  it('gera sessões quinzenais e personalizadas sem avançar para o próximo mês', () => {
    expect(monthlyRecurrenceDates('2026-09-08', 'biweekly')).toEqual([
      '2026-09-08', '2026-09-22',
    ]);
    expect(monthlyRecurrenceDates('2026-09-08', 'custom', 10)).toEqual([
      '2026-09-08', '2026-09-18', '2026-09-28',
    ]);
  });

  it('desloca o vencimento pela mesma distância civil da sessão', () => {
    const distance = civilDaysBetween('2026-09-08', '2026-09-22');
    expect(shiftCivilDate('2026-09-07', distance)).toBe('2026-09-21');
  });

  it('recusa campos e duração inválidos', () => {
    expect(() => clinicDateTimeToIso('21/08/2026', '14:30')).toThrow('data e um horário válidos');
    expect(() => manualAppointmentTimes({ date: '2026-08-21', time: '14:30', durationMinutes: 5 }))
      .toThrow('duração');
    expect(() => monthlyRecurrenceDates('2026-08-21', 'custom', 0)).toThrow('intervalo personalizado');
  });
});
