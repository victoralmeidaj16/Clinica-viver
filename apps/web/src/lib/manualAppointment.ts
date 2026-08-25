import { FUSO_CLINICA } from './sessionReference';

export type ManualAppointmentMode = 'video' | 'in_person' | 'phone';

const LOCAL_DATE = /^\d{4}-\d{2}-\d{2}$/;
const LOCAL_TIME = /^([01]\d|2[0-3]):[0-5]\d$/;

/** Data escolhida pelo profissional, interpretada no fuso civil da clínica. */
export function clinicDateTimeToIso(date: string, time: string): string {
  if (!LOCAL_DATE.test(date) || !LOCAL_TIME.test(time)) {
    throw new Error('Informe uma data e um horário válidos.');
  }
  const parsed = new Date(`${date}T${time}:00-03:00`);
  if (!Number.isFinite(parsed.getTime())) throw new Error('Data do agendamento inválida.');
  return parsed.toISOString();
}

export function todayAtClinic(now: Date = new Date()): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: FUSO_CLINICA,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(now);
}

export interface ClinicalServiceOption {
  key: string;
  label: string;
  durationMinutes: number;
}

export const CLINICAL_SERVICES: readonly ClinicalServiceOption[] = [
  {
    key: 'PSICOTERAPIA',
    label: 'Atendimento Psicológico (Psicoterapia Individual)',
    durationMinutes: 50,
  },
  {
    key: 'AVALIACAO',
    label: 'Avaliação Psicológica e Neuropsicológica',
    durationMinutes: 50,
  },
  {
    key: 'ORIENTACAO_PARENTAL',
    label: 'Orientação Parental',
    durationMinutes: 50,
  },
  {
    key: 'ORIENTACAO_PROFISSIONAL',
    label: 'Orientação Profissional / Vocacional',
    durationMinutes: 50,
  },
  {
    key: 'PSICOTERAPIA_CASAL',
    label: 'Psicoterapia de Casal',
    durationMinutes: 90,
  },
] as const;

export function getServiceDuration(serviceKey: string): number {
  const service = CLINICAL_SERVICES.find((item) => item.key === serviceKey);
  return service ? service.durationMinutes : 50;
}

export function manualAppointmentTimes(input: {
  date: string;
  time: string;
  durationMinutes: number;
}): { startsAt: string; endsAt: string } {
  if (!Number.isInteger(input.durationMinutes) || input.durationMinutes < 15 || input.durationMinutes > 240) {
    throw new Error('A duração deve ficar entre 15 e 240 minutos.');
  }
  const startsAt = clinicDateTimeToIso(input.date, input.time);
  return {
    startsAt,
    endsAt: new Date(Date.parse(startsAt) + input.durationMinutes * 60_000).toISOString(),
  };
}

