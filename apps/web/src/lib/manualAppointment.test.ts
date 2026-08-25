import { describe, expect, it } from 'vitest';
import {
  CLINICAL_SERVICES,
  clinicDateTimeToIso,
  getServiceDuration,
  manualAppointmentTimes,
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

  it('recusa campos e duração inválidos', () => {
    expect(() => clinicDateTimeToIso('21/08/2026', '14:30')).toThrow('data e um horário válidos');
    expect(() => manualAppointmentTimes({ date: '2026-08-21', time: '14:30', durationMinutes: 5 }))
      .toThrow('duração');
  });
});

