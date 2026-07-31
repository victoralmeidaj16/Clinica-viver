import type {
  Appointment,
  AppointmentEvent,
  AppointmentStatus,
  CalendarBlock,
  ExternalCalendarConnection,
  ExternalCalendarEventLink,
  ProfessionalAvailabilityRule,
} from './types';

export interface AppointmentFilter {
  organizationId: string;
  patientId?: string;
  professionalId?: string;
  statuses?: readonly AppointmentStatus[];
  startsFrom?: string;
  startsUntil?: string;
}

export interface CommitAppointmentInput {
  appointment: Appointment;
  expectedVersion: number;
  commandId: string;
  events: readonly AppointmentEvent[];
}

export interface AppointmentRepository {
  getById(organizationId: string, appointmentId: string): Promise<Appointment | null>;
  list(filter: AppointmentFilter): Promise<readonly Appointment[]>;
  findByCommandId(organizationId: string, commandId: string): Promise<Appointment | null>;
  commit(input: CommitAppointmentInput): Promise<void>;
}

export interface AvailabilityRepository {
  listRules(organizationId: string, professionalId: string): Promise<readonly ProfessionalAvailabilityRule[]>;
  listBlocks(input: { organizationId: string; professionalId: string; startsFrom: string; startsUntil: string }): Promise<readonly CalendarBlock[]>;
}

export interface ExternalCalendarConnectionRepository {
  getByProfessional(organizationId: string, professionalId: string): Promise<ExternalCalendarConnection | null>;
  save(connection: ExternalCalendarConnection): Promise<void>;
  getEventLink(organizationId: string, appointmentId: string): Promise<ExternalCalendarEventLink | null>;
  saveEventLink(link: ExternalCalendarEventLink): Promise<void>;
}

export interface ExternalCalendarProviderPort {
  beginAuthorization(input: {
    organizationId: string;
    professionalId: string;
    provider: 'google_calendar';
    redirectUri: string;
  }): Promise<{ authorizationUrl: string; stateReference: string }>;
  completeAuthorization(input: {
    organizationId: string;
    professionalId: string;
    provider: 'google_calendar';
    code: string;
    stateReference: string;
  }): Promise<{ providerAccountReference: string; calendarId: string }>;
  upsertAppointment(input: {
    connection: ExternalCalendarConnection;
    appointment: Appointment;
    existingProviderEventId?: string;
  }): Promise<{ providerEventId: string; etag?: string }>;
  removeAppointment(input: {
    connection: ExternalCalendarConnection;
    providerEventId: string;
  }): Promise<void>;
  pullChanges(input: {
    connection: ExternalCalendarConnection;
  }): Promise<{ nextCursor?: string; changedEventIds: readonly string[] }>;
}

export interface AppointmentNotificationPort {
  scheduleReminder(input: { appointment: Appointment; reminder: Appointment['reminders'][number] }): Promise<void>;
  cancelReminders(organizationId: string, appointmentId: string): Promise<void>;
}
