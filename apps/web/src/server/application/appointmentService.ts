import { assertStaffAuthorized, cancelAppointmentCommand, confirmAppointmentCommand, enqueueNotification, rescheduleAppointmentCommand, scheduleAppointmentCommand, type ScheduleAppointmentInput } from '@thats-life/core';
import type { RequestContext } from './context';
import { ApplicationError } from './http';
import { getApplicationStore } from './store';

const names: Record<string, string> = { 'professional-1': 'Dra. Camila' };
export async function listAppointments(context: RequestContext) {
  assertStaffAuthorized(context.actor, 'schedule.read', { organizationId: context.actor.organizationId });
  return getApplicationStore().appointments.list({ organizationId: context.actor.organizationId });
}

export async function createAppointmentFlow(context: RequestContext, input: ScheduleAppointmentInput) {
  const store = getApplicationStore();
  const result = await scheduleAppointmentCommand({ appointments: store.appointments, identities: store.identities }, context.actor, input, { actorUserId: context.actor.userId, occurredAt: input.createdAt, correlationId: context.correlationId, commandId: context.idempotencyKey! });
  const preference = store.preferences.find((item) => item.organizationId === input.organizationId && item.patientId === input.patientId);
  if (!preference) throw new ApplicationError('PREFERENCE_NOT_FOUND', 'Preferências de comunicação não encontradas.', 409);
  const scheduledFor = new Date(Date.parse(input.startsAt) - 60 * 60 * 1000).toISOString();
  const notification = await enqueueNotification({ id: `notification-${result.appointment.id}`, organizationId: input.organizationId, patientId: input.patientId, recipientReference: `contact-${input.patientId}`, channel: 'whatsapp', template: { category: 'appointment_reminder', professionalName: names[input.professionalId] ?? 'Profissional', appointmentLabel: new Date(input.startsAt).toLocaleString('pt-BR', { timeZone: input.timezone }) }, preference, consents: store.consents, scheduledFor, idempotencyKey: `${context.idempotencyKey}:reminder`, createdAt: input.createdAt }, store.notifications, store.communicationAudit);
  return { appointment: result.appointment, reminder: { id: notification.message.id, status: notification.message.status }, idempotentReplay: result.idempotentReplay };
}

export async function changeAppointment(context: RequestContext, id: string, body: Record<string, unknown>) {
  const store = getApplicationStore(); const metadata = { actorUserId: context.actor.userId, occurredAt: String(body.occurredAt ?? new Date().toISOString()), correlationId: context.correlationId, commandId: context.idempotencyKey! };
  if (body.action === 'confirm') return confirmAppointmentCommand({ appointments: store.appointments, identities: store.identities }, context.actor, id, metadata);
  if (body.action === 'cancel') return cancelAppointmentCommand({ appointments: store.appointments, identities: store.identities }, context.actor, id, String(body.reasonCode ?? 'USER_REQUEST'), metadata);
  if (body.action === 'reschedule') return rescheduleAppointmentCommand({ appointments: store.appointments, identities: store.identities }, context.actor, id, String(body.startsAt ?? ''), String(body.endsAt ?? ''), metadata);
  throw new ApplicationError('INVALID_ACTION', 'Ação de agendamento inválida.', 400);
}

export function parseAppointmentInput(body: Record<string, unknown>, context: RequestContext): ScheduleAppointmentInput {
  return { id: String(body.id ?? ''), organizationId: context.actor.organizationId, patientId: String(body.patientId ?? ''), professionalId: String(body.professionalId ?? context.actor.professionalProfileId ?? ''), startsAt: String(body.startsAt ?? ''), endsAt: String(body.endsAt ?? ''), timezone: String(body.timezone ?? 'America/Sao_Paulo'), mode: body.mode === 'in_person' || body.mode === 'phone' ? body.mode : 'video', reminders: [{ id: `${String(body.id ?? '')}-reminder`, channel: 'whatsapp', minutesBefore: 60 }], createdAt: String(body.createdAt ?? new Date().toISOString()) };
}
