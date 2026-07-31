import { assertStaffAuthorized, type IdentityRepository, type StaffAccessContext } from '../identity';
import { cancelAppointment, confirmAppointment, rescheduleAppointment, scheduleAppointment, type ScheduleAppointmentInput } from './aggregate';
import type { AppointmentCommandMetadata } from './eventFactory';
import type { AppointmentRepository } from './ports';
import type { Appointment, AppointmentTransitionResult } from './types';

export interface SchedulingDependencies { appointments: AppointmentRepository; identities: IdentityRepository; }
export interface PersistedAppointmentMetadata extends AppointmentCommandMetadata { commandId: string; }
export interface AppointmentCommandResult { appointment: Appointment; idempotentReplay: boolean; }

function overlaps(firstStart: string, firstEnd: string, secondStart: string, secondEnd: string): boolean {
  return Date.parse(firstStart) < Date.parse(secondEnd) && Date.parse(secondStart) < Date.parse(firstEnd);
}

async function assertNoConflict(repository: AppointmentRepository, appointment: Appointment, ignoredId?: string): Promise<void> {
  const existing = await repository.list({ organizationId: appointment.organizationId, professionalId: appointment.professionalId, statuses: ['scheduled', 'confirmed'] });
  if (existing.some((item) => item.id !== ignoredId && overlaps(appointment.startsAt, appointment.endsAt, item.startsAt, item.endsAt))) {
    throw new Error('Há conflito com outro agendamento do profissional.');
  }
}

async function execute(
  dependencies: SchedulingDependencies, actor: StaffAccessContext, appointmentId: string, metadata: PersistedAppointmentMetadata,
  transition: (appointment: Appointment) => AppointmentTransitionResult
): Promise<AppointmentCommandResult> {
  const replay = await dependencies.appointments.findByCommandId(actor.organizationId, metadata.commandId);
  if (replay) return { appointment: replay, idempotentReplay: true };
  const current = await dependencies.appointments.getById(actor.organizationId, appointmentId);
  if (!current) throw new Error('Agendamento não encontrado na organização.');
  assertStaffAuthorized(actor, 'schedule.write', { organizationId: current.organizationId, patientId: current.patientId, assignedProfessionalIds: [current.professionalId] });
  const result = transition(current);
  if (result.appointment.status !== 'cancelled') await assertNoConflict(dependencies.appointments, result.appointment, current.id);
  await dependencies.appointments.commit({ appointment: result.appointment, expectedVersion: current.version, commandId: metadata.commandId, events: result.events });
  return { appointment: result.appointment, idempotentReplay: false };
}

export async function scheduleAppointmentCommand(dependencies: SchedulingDependencies, actor: StaffAccessContext, input: ScheduleAppointmentInput, metadata: PersistedAppointmentMetadata): Promise<AppointmentCommandResult> {
  if (actor.organizationId !== input.organizationId) throw new Error('Acesso negado: cross_tenant.');
  const replay = await dependencies.appointments.findByCommandId(actor.organizationId, metadata.commandId);
  if (replay) return { appointment: replay, idempotentReplay: true };
  const [patient, professional] = await Promise.all([
    dependencies.identities.getPatient(input.organizationId, input.patientId),
    dependencies.identities.getProfessional(input.organizationId, input.professionalId),
  ]);
  if (!patient || !professional || !patient.assignedProfessionalIds.includes(professional.id)) throw new Error('Paciente ou profissional não está disponível para o agendamento.');
  assertStaffAuthorized(actor, 'schedule.write', { organizationId: input.organizationId, patientId: input.patientId, assignedProfessionalIds: patient.assignedProfessionalIds });
  const result = scheduleAppointment(input, metadata);
  await assertNoConflict(dependencies.appointments, result.appointment);
  await dependencies.appointments.commit({ appointment: result.appointment, expectedVersion: 0, commandId: metadata.commandId, events: result.events });
  return { appointment: result.appointment, idempotentReplay: false };
}

export const confirmAppointmentCommand = (dependencies: SchedulingDependencies, actor: StaffAccessContext, id: string, metadata: PersistedAppointmentMetadata) => execute(dependencies, actor, id, metadata, (appointment) => confirmAppointment(appointment, metadata));
export const rescheduleAppointmentCommand = (dependencies: SchedulingDependencies, actor: StaffAccessContext, id: string, startsAt: string, endsAt: string, metadata: PersistedAppointmentMetadata) => execute(dependencies, actor, id, metadata, (appointment) => rescheduleAppointment(appointment, startsAt, endsAt, metadata));
export const cancelAppointmentCommand = (dependencies: SchedulingDependencies, actor: StaffAccessContext, id: string, reasonCode: string, metadata: PersistedAppointmentMetadata) => execute(dependencies, actor, id, metadata, (appointment) => cancelAppointment(appointment, reasonCode, metadata));
