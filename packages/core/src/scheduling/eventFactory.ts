import type { Appointment, AppointmentEvent, AppointmentEventType } from './types';
import { requireSchedulingIsoDate, requireSchedulingText } from './validation';

export interface AppointmentCommandMetadata {
  actorUserId: string;
  occurredAt: string;
  correlationId: string;
}

export function createAppointmentEvent(
  appointment: Appointment,
  type: AppointmentEventType,
  metadata: AppointmentCommandMetadata,
  details?: AppointmentEvent['metadata']
): AppointmentEvent {
  const correlationId = requireSchedulingText(metadata.correlationId, 'correlationId');
  return {
    id: `${correlationId}:${type}`,
    type,
    organizationId: appointment.organizationId,
    appointmentId: appointment.id,
    patientId: appointment.patientId,
    professionalId: appointment.professionalId,
    actorUserId: requireSchedulingText(metadata.actorUserId, 'actorUserId'),
    occurredAt: requireSchedulingIsoDate(metadata.occurredAt, 'occurredAt'),
    correlationId,
    metadata: details,
  };
}

export function evolveAppointment(
  appointment: Appointment,
  changes: Partial<Appointment>,
  occurredAt: string
): Appointment {
  const normalized = requireSchedulingIsoDate(occurredAt, 'occurredAt');
  if (Date.parse(normalized) < Date.parse(appointment.updatedAt)) {
    throw new Error('A alteração não pode anteceder a última atualização.');
  }
  return { ...appointment, ...changes, version: appointment.version + 1, updatedAt: normalized };
}
