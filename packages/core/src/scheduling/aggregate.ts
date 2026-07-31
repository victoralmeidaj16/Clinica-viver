import { createAppointmentEvent, evolveAppointment, type AppointmentCommandMetadata } from './eventFactory';
import type { Appointment, AppointmentReminder, AppointmentTransitionResult } from './types';
import { requireSchedulingIsoDate, requireSchedulingText, validateTimeRange } from './validation';

export interface ScheduleAppointmentInput {
  id: string;
  organizationId: string;
  patientId: string;
  professionalId: string;
  startsAt: string;
  endsAt: string;
  timezone: string;
  mode: Appointment['mode'];
  reminders: readonly AppointmentReminder[];
  createdAt: string;
}

function validateReminders(reminders: readonly AppointmentReminder[]): AppointmentReminder[] {
  const ids = new Set<string>();
  return reminders.map((reminder) => {
    const id = requireSchedulingText(reminder.id, 'reminder.id');
    if (ids.has(id)) throw new Error('Não pode haver lembretes duplicados.');
    ids.add(id);
    if (!Number.isInteger(reminder.minutesBefore) || reminder.minutesBefore < 0) {
      throw new Error('minutesBefore deve ser um número inteiro não negativo.');
    }
    return { ...reminder, id };
  });
}

export function scheduleAppointment(
  input: ScheduleAppointmentInput,
  metadata: AppointmentCommandMetadata
): AppointmentTransitionResult {
  const startsAt = requireSchedulingIsoDate(input.startsAt, 'startsAt');
  const endsAt = requireSchedulingIsoDate(input.endsAt, 'endsAt');
  validateTimeRange(startsAt, endsAt, 'agendamento');
  const createdAt = requireSchedulingIsoDate(input.createdAt, 'createdAt');
  if (Date.parse(metadata.occurredAt) < Date.parse(createdAt)) {
    throw new Error('O evento não pode anteceder a criação do agendamento.');
  }
  const appointment: Appointment = {
    schemaVersion: 1,
    id: requireSchedulingText(input.id, 'id'),
    organizationId: requireSchedulingText(input.organizationId, 'organizationId'),
    patientId: requireSchedulingText(input.patientId, 'patientId'),
    professionalId: requireSchedulingText(input.professionalId, 'professionalId'),
    startsAt,
    endsAt,
    timezone: requireSchedulingText(input.timezone, 'timezone'),
    mode: input.mode,
    status: 'scheduled',
    reminders: validateReminders(input.reminders),
    version: 1,
    createdAt,
    updatedAt: createdAt,
  };
  return { appointment, events: [createAppointmentEvent(appointment, 'appointment.scheduled', metadata)] };
}

export function confirmAppointment(appointment: Appointment, metadata: AppointmentCommandMetadata): AppointmentTransitionResult {
  if (appointment.status !== 'scheduled') throw new Error('Somente um agendamento marcado pode ser confirmado.');
  const next = evolveAppointment(appointment, { status: 'confirmed' }, metadata.occurredAt);
  return { appointment: next, events: [createAppointmentEvent(next, 'appointment.confirmed', metadata)] };
}

export function rescheduleAppointment(
  appointment: Appointment,
  startsAt: string,
  endsAt: string,
  metadata: AppointmentCommandMetadata
): AppointmentTransitionResult {
  if (!['scheduled', 'confirmed'].includes(appointment.status)) throw new Error('O agendamento não pode ser reagendado.');
  const nextStart = requireSchedulingIsoDate(startsAt, 'startsAt');
  const nextEnd = requireSchedulingIsoDate(endsAt, 'endsAt');
  validateTimeRange(nextStart, nextEnd, 'agendamento');
  const next = evolveAppointment(appointment, { startsAt: nextStart, endsAt: nextEnd, status: 'scheduled' }, metadata.occurredAt);
  return { appointment: next, events: [createAppointmentEvent(next, 'appointment.rescheduled', metadata)] };
}

export function cancelAppointment(appointment: Appointment, reasonCode: string, metadata: AppointmentCommandMetadata): AppointmentTransitionResult {
  if (!['scheduled', 'confirmed'].includes(appointment.status)) throw new Error('O agendamento não pode ser cancelado.');
  const next = evolveAppointment(appointment, { status: 'cancelled', cancellationReasonCode: requireSchedulingText(reasonCode, 'reasonCode') }, metadata.occurredAt);
  return { appointment: next, events: [createAppointmentEvent(next, 'appointment.cancelled', metadata)] };
}
