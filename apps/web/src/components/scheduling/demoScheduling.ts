import { scheduleAppointment, type Appointment, type CarePlan } from '@thats-life/core';

const meta = (id: string) => ({ actorUserId: 'user-demo', occurredAt: '2026-07-31T12:00:00.000Z', correlationId: id });
export const patientNames: Record<string, string> = { 'patient-1': 'Marina Costa', 'patient-2': 'Lucas Ribeiro', 'patient-3': 'Ana Souza' };

const appointmentRows: Array<[string, string, string, string, Appointment['mode']]> = [
  ['appointment-1', 'patient-1', '2026-08-03T12:00:00.000Z', '2026-08-03T12:50:00.000Z', 'video'],
  ['appointment-2', 'patient-2', '2026-08-03T14:00:00.000Z', '2026-08-03T14:50:00.000Z', 'in_person'],
  ['appointment-3', 'patient-3', '2026-08-04T13:00:00.000Z', '2026-08-04T13:50:00.000Z', 'video'],
  ['appointment-4', 'patient-1', '2026-08-06T15:00:00.000Z', '2026-08-06T15:50:00.000Z', 'phone'],
];
export const demoAppointments: Appointment[] = appointmentRows.map(([id, patientId, startsAt, endsAt, mode]) => scheduleAppointment({ id, organizationId: 'org-demo', patientId, professionalId: 'professional-1', startsAt, endsAt, timezone: 'America/Sao_Paulo', mode, reminders: [{ id: `${id}-reminder`, channel: 'whatsapp', minutesBefore: 60 }], createdAt: '2026-07-31T12:00:00.000Z' }, meta(`schedule-${id}`)).appointment);

export const demoCarePlans: CarePlan[] = [
  { schemaVersion: 1, id: 'plan-1', organizationId: 'org-demo', patientId: 'patient-1', professionalId: 'professional-1', goals: [{ id: 'goal-1', title: 'Construir uma rotina sustentável de autocuidado', status: 'active', targetDate: '2026-09-30T23:59:00.000Z' }, { id: 'goal-2', title: 'Ampliar repertório de regulação emocional', status: 'active' }], tasks: [{ id: 'task-1', title: 'Registrar três momentos positivos do dia', status: 'pending', patientVisible: true, dueAt: '2026-08-04T23:59:00.000Z' }, { id: 'task-2', title: 'Praticar respiração consciente por cinco minutos', status: 'completed', patientVisible: true, completedAt: '2026-07-30T20:00:00.000Z' }], status: 'active', version: 3, createdAt: '2026-07-01T12:00:00.000Z', updatedAt: '2026-07-30T20:00:00.000Z' },
  { schemaVersion: 1, id: 'plan-2', organizationId: 'org-demo', patientId: 'patient-2', professionalId: 'professional-1', goals: [{ id: 'goal-3', title: 'Organizar limites entre trabalho e descanso', status: 'active' }], tasks: [{ id: 'task-3', title: 'Encerrar notificações de trabalho após as 19h', status: 'pending', patientVisible: true }], status: 'active', version: 2, createdAt: '2026-07-10T12:00:00.000Z', updatedAt: '2026-07-28T12:00:00.000Z' },
];
