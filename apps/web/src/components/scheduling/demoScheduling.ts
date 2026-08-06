import { scheduleAppointment, type Appointment, type CarePlan } from '@thats-life/core';

const meta = (id: string) => ({ actorUserId: 'user-demo', occurredAt: '2026-07-31T12:00:00.000Z', correlationId: id });
export const patientNames: Record<string, string> = {};
export const demoAppointments: Appointment[] = [];
export const demoCarePlans: CarePlan[] = [];
