import { FUSO_CLINICA } from './sessionReference';

export type ManualAppointmentMode = 'video' | 'in_person' | 'phone';
export type AppointmentFrequency = 'weekly' | 'biweekly' | 'custom';

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
  /** Duração sugerida; nos serviços de duração variável é só o ponto de partida. */
  durationMinutes: number;
  /** O profissional informa a duração de cada agendamento. */
  variableDuration?: boolean;
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
    variableDuration: true,
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

export function hasVariableDuration(serviceKey: string): boolean {
  return CLINICAL_SERVICES.some((item) => item.key === serviceKey && item.variableDuration);
}

function addCivilDays(date: string, days: number): string {
  if (!LOCAL_DATE.test(date)) throw new Error('Informe uma data válida.');
  const [year, month, day] = date.split('-').map(Number);
  const value = new Date(Date.UTC(year, month - 1, day + days));
  return value.toISOString().slice(0, 10);
}

/** Gera as ocorrências a partir da primeira data, sem ultrapassar o mês civil escolhido. */
export function monthlyRecurrenceDates(
  firstDate: string,
  frequency: AppointmentFrequency,
  customIntervalDays = 7
): string[] {
  const intervalDays = frequency === 'weekly' ? 7 : frequency === 'biweekly' ? 14 : customIntervalDays;
  if (!Number.isInteger(intervalDays) || intervalDays < 1 || intervalDays > 30) {
    throw new Error('O intervalo personalizado deve ficar entre 1 e 30 dias.');
  }
  if (!LOCAL_DATE.test(firstDate)) throw new Error('Informe uma data válida.');

  const month = firstDate.slice(0, 7);
  const dates: string[] = [];
  for (let offset = 0; ; offset += intervalDays) {
    const occurrence = addCivilDays(firstDate, offset);
    if (!occurrence.startsWith(month)) break;
    dates.push(occurrence);
  }
  return dates;
}

export function civilDaysBetween(firstDate: string, nextDate: string): number {
  const parse = (value: string) => {
    if (!LOCAL_DATE.test(value)) throw new Error('Informe uma data válida.');
    const [year, month, day] = value.split('-').map(Number);
    return Date.UTC(year, month - 1, day);
  };
  return Math.round((parse(nextDate) - parse(firstDate)) / 86_400_000);
}

export function shiftCivilDate(date: string, days: number): string {
  return addCivilDays(date, days);
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
