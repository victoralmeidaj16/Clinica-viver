export type AppointmentStatus =
  | 'scheduled'
  | 'confirmed'
  | 'cancelled'
  | 'no_show'
  | 'completed';

export type AppointmentMode = 'in_person' | 'video' | 'phone';

export interface AppointmentReminder {
  id: string;
  channel: 'email' | 'whatsapp' | 'push';
  minutesBefore: number;
}

export interface AppointmentRecurrence {
  frequency: 'weekly';
  interval: number;
  until?: string;
  count?: number;
}

export interface Appointment {
  schemaVersion: 1;
  id: string;
  organizationId: string;
  patientId: string;
  professionalId: string;
  startsAt: string;
  endsAt: string;
  timezone: string;
  mode: AppointmentMode;
  status: AppointmentStatus;
  reminders: readonly AppointmentReminder[];
  recurrence?: AppointmentRecurrence;
  clinicalSessionId?: string;
  cancellationReasonCode?: string;
  version: number;
  createdAt: string;
  updatedAt: string;
}

export interface ProfessionalAvailabilityRule {
  id: string;
  organizationId: string;
  professionalId: string;
  weekday: 0 | 1 | 2 | 3 | 4 | 5 | 6;
  startsAtLocalTime: string;
  endsAtLocalTime: string;
  timezone: string;
  active: boolean;
}

export interface CalendarBlock {
  id: string;
  organizationId: string;
  professionalId: string;
  startsAt: string;
  endsAt: string;
  reasonCode: string;
}

export interface ExternalCalendarConnection {
  id: string;
  organizationId: string;
  professionalId: string;
  provider: 'google_calendar';
  status: 'pending' | 'connected' | 'revoked' | 'error';
  calendarId?: string;
  providerAccountReference?: string;
  syncCursor?: string;
  lastSyncedAt?: string;
  errorCode?: string;
  createdAt: string;
  updatedAt: string;
}

export interface ExternalCalendarEventLink {
  provider: 'google_calendar';
  connectionId: string;
  appointmentId: string;
  providerEventId: string;
  etag?: string;
  updatedAt: string;
}

export type AppointmentEventType =
  | 'appointment.scheduled'
  | 'appointment.confirmed'
  | 'appointment.rescheduled'
  | 'appointment.cancelled'
  | 'appointment.no_show'
  | 'appointment.completed'
  | 'appointment.calendar_sync_requested';

export interface AppointmentEvent {
  id: string;
  type: AppointmentEventType;
  organizationId: string;
  appointmentId: string;
  patientId: string;
  professionalId: string;
  actorUserId: string;
  occurredAt: string;
  correlationId: string;
  metadata?: Readonly<Record<string, string | number | boolean>>;
}

export interface AppointmentTransitionResult {
  appointment: Appointment;
  events: readonly AppointmentEvent[];
}
