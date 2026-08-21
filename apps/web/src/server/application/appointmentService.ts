import { assertStaffAuthorized, cancelAppointmentCommand, confirmAppointmentCommand, enqueueNotification, rescheduleAppointmentCommand, scheduleAppointmentCommand, type ScheduleAppointmentInput } from '@thats-life/core';
import type { RequestContext } from './context';
import { ApplicationError } from './http';
import { getApplicationStore, persistApplicationState } from './store';

export async function listAppointments(context: RequestContext) {
  assertStaffAuthorized(context.actor, 'schedule.read', { organizationId: context.actor.organizationId });
  const clinicalOnly = context.actor.roles.includes('professional') &&
    !context.actor.roles.some((role) => role === 'owner' || role === 'admin' || role === 'clinical_director');
  return getApplicationStore().appointments.list({
    organizationId: context.actor.organizationId,
    ...(clinicalOnly && context.actor.professionalProfileId
      ? { professionalId: context.actor.professionalProfileId }
      : {}),
  });
}

export async function createAppointmentFlow(context: RequestContext, input: ScheduleAppointmentInput) {
  if (context.actor.roles.includes('professional') && context.actor.professionalProfileId !== input.professionalId) {
    throw new ApplicationError('FORBIDDEN', 'Um psicólogo só pode agendar para o próprio perfil.', 403);
  }
  const store = getApplicationStore();
  const result = await scheduleAppointmentCommand({ appointments: store.appointments, identities: store.identities }, context.actor, input, { actorUserId: context.actor.userId, occurredAt: input.createdAt, correlationId: context.correlationId, commandId: context.idempotencyKey! });
  const preference = store.preferences.find((item) => item.organizationId === input.organizationId && item.patientId === input.patientId);
  let reminder: { id?: string; status: string } = { status: 'skipped' };
  // O lembrete externo é complementar. Ausência de preferência ou consentimento
  // não pode transformar um agendamento já persistido em erro para a interface.
  if (preference) {
    try {
      const scheduledFor = new Date(Date.parse(input.startsAt) - 60 * 60 * 1000).toISOString();
      const professional = await store.identities.getProfessional(input.organizationId, input.professionalId);
      const notification = await enqueueNotification({ id: `notification-${result.appointment.id}`, organizationId: input.organizationId, patientId: input.patientId, recipientReference: `contact-${input.patientId}`, channel: 'whatsapp', template: { category: 'appointment_reminder', professionalName: professional?.displayName ?? 'Profissional', appointmentLabel: new Date(input.startsAt).toLocaleString('pt-BR', { timeZone: input.timezone }) }, preference, consents: store.consents, scheduledFor, idempotencyKey: `${context.idempotencyKey}:reminder`, createdAt: input.createdAt }, store.notifications, store.communicationAudit);
      reminder = { id: notification.message.id, status: notification.message.status };
    } catch (error) {
      console.error('[agenda] Agendamento criado sem lembrete externo:', error instanceof Error ? error.message : error);
    }
  }
  await persistApplicationState();
  return { appointment: result.appointment, reminder, idempotentReplay: result.idempotentReplay };
}

export async function changeAppointment(context: RequestContext, id: string, body: Record<string, unknown>) {
  const store = getApplicationStore(); const metadata = { actorUserId: context.actor.userId, occurredAt: String(body.occurredAt ?? new Date().toISOString()), correlationId: context.correlationId, commandId: context.idempotencyKey! };
  const dependencies = { appointments: store.appointments, identities: store.identities };
  const result =
    body.action === 'confirm'
      ? await confirmAppointmentCommand(dependencies, context.actor, id, metadata)
      : body.action === 'cancel'
        ? await cancelAppointmentCommand(dependencies, context.actor, id, String(body.reasonCode ?? 'USER_REQUEST'), metadata)
        : body.action === 'reschedule'
          ? await rescheduleAppointmentCommand(dependencies, context.actor, id, String(body.startsAt ?? ''), String(body.endsAt ?? ''), metadata)
          : null;
  if (!result) throw new ApplicationError('INVALID_ACTION', 'Ação de agendamento inválida.', 400);
  await persistApplicationState();
  return result;
}

export function parseAppointmentInput(body: Record<string, unknown>, context: RequestContext): ScheduleAppointmentInput {
  return { id: String(body.id ?? ''), organizationId: context.actor.organizationId, patientId: String(body.patientId ?? ''), professionalId: String(body.professionalId ?? context.actor.professionalProfileId ?? ''), startsAt: String(body.startsAt ?? ''), endsAt: String(body.endsAt ?? ''), timezone: String(body.timezone ?? 'America/Sao_Paulo'), mode: body.mode === 'in_person' || body.mode === 'phone' ? body.mode : 'video', reminders: [{ id: `${String(body.id ?? '')}-reminder`, channel: 'whatsapp', minutesBefore: 60 }], createdAt: String(body.createdAt ?? new Date().toISOString()) };
}
