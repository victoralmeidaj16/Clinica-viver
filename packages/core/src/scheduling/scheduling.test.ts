import { describe, expect, it } from 'vitest';
import {
  InMemoryIdentityRepository,
  createPatientProfile,
  createProfessionalProfile,
  type StaffAccessContext,
} from '../identity';
import {
  InMemoryAppointmentRepository,
  InMemoryExternalCalendarConnectionRepository,
  beginGoogleCalendarConnection,
  cancelAppointment,
  completeGoogleCalendarConnection,
  confirmAppointment,
  rescheduleAppointment,
  scheduleAppointment,
  scheduleAppointmentCommand,
  type AppointmentCommandMetadata,
  type ExternalCalendarProviderPort,
  type ScheduleAppointmentInput,
} from './index';

const organizationId = 'org-1';
const patientId = 'patient-1';
const professionalId = 'professional-1';

function metadata(occurredAt: string, correlationId = `correlation-${occurredAt}`): AppointmentCommandMetadata {
  return { actorUserId: 'user-professional', occurredAt, correlationId };
}

function input(overrides: Partial<ScheduleAppointmentInput> = {}): ScheduleAppointmentInput {
  return {
    id: 'appointment-1',
    organizationId,
    patientId,
    professionalId,
    startsAt: '2026-08-03T12:00:00.000Z',
    endsAt: '2026-08-03T12:50:00.000Z',
    timezone: 'America/Sao_Paulo',
    mode: 'video',
    reminders: [{ id: 'reminder-1', channel: 'whatsapp', minutesBefore: 60 }],
    createdAt: '2026-08-01T10:00:00.000Z',
    ...overrides,
  };
}

const actor: StaffAccessContext = {
  actorType: 'staff',
  organizationId,
  userId: 'user-professional',
  membershipId: 'membership-1',
  membershipStatus: 'active',
  roles: ['professional'],
  professionalProfileId: professionalId,
};

function identities() {
  return new InMemoryIdentityRepository({
    patients: [createPatientProfile({
      id: patientId, organizationId, displayName: 'Paciente Fictício',
      primaryProfessionalId: professionalId, assignedProfessionalIds: [professionalId],
      createdAt: '2026-08-01T09:00:00.000Z',
    })],
    professionals: [createProfessionalProfile({
      id: professionalId, organizationId, userId: actor.userId, displayName: 'Dra. Camila',
      councilType: 'CRP', councilRegistration: '06/148293', specialties: ['TCC'],
      createdAt: '2026-08-01T09:00:00.000Z',
    })],
  });
}

describe('appointment aggregate', () => {
  it('agenda, confirma, reagenda e cancela preservando o ciclo válido', () => {
    let appointment = scheduleAppointment(input(), metadata('2026-08-01T10:00:00.000Z')).appointment;
    appointment = confirmAppointment(appointment, metadata('2026-08-01T10:01:00.000Z')).appointment;
    appointment = rescheduleAppointment(appointment, '2026-08-03T13:00:00.000Z', '2026-08-03T13:50:00.000Z', metadata('2026-08-01T10:02:00.000Z')).appointment;
    expect(appointment.status).toBe('scheduled');
    appointment = cancelAppointment(appointment, 'PATIENT_REQUEST', metadata('2026-08-01T10:03:00.000Z')).appointment;
    expect(appointment).toMatchObject({ status: 'cancelled', cancellationReasonCode: 'PATIENT_REQUEST' });
  });

  it('rejeita intervalo inválido e lembretes duplicados', () => {
    expect(() => scheduleAppointment(input({ endsAt: '2026-08-03T12:00:00.000Z' }), metadata('2026-08-01T10:00:00.000Z'))).toThrow('posterior ao início');
    expect(() => scheduleAppointment(input({ reminders: [
      { id: 'same', channel: 'push', minutesBefore: 10 },
      { id: 'same', channel: 'email', minutesBefore: 20 },
    ] }), metadata('2026-08-01T10:00:00.000Z'))).toThrow('lembretes duplicados');
  });
});

describe('appointment commands', () => {
  it('impede conflitos de profissional e repete comandos com segurança', async () => {
    const appointments = new InMemoryAppointmentRepository();
    const dependencies = { appointments, identities: identities() };
    const commandMetadata = { ...metadata('2026-08-01T10:00:00.000Z', 'create-appointment'), commandId: 'command-1' };
    const first = await scheduleAppointmentCommand(dependencies, actor, input(), commandMetadata);
    const replay = await scheduleAppointmentCommand(dependencies, actor, input(), commandMetadata);
    expect(first.idempotentReplay).toBe(false);
    expect(replay.idempotentReplay).toBe(true);
    await expect(scheduleAppointmentCommand(dependencies, actor, input({ id: 'appointment-2', startsAt: '2026-08-03T12:30:00.000Z', endsAt: '2026-08-03T13:20:00.000Z' }), { ...metadata('2026-08-01T10:01:00.000Z'), commandId: 'command-2' })).rejects.toThrow('conflito');
    expect(appointments.listOutboxEvents()).toHaveLength(1);
  });

  it('bloqueia organização diferente antes de consultar os dados', async () => {
    await expect(scheduleAppointmentCommand(
      { appointments: new InMemoryAppointmentRepository(), identities: identities() },
      { ...actor, organizationId: 'org-2' }, input(),
      { ...metadata('2026-08-01T10:00:00.000Z'), commandId: 'cross-tenant' }
    )).rejects.toThrow('cross_tenant');
  });
});

describe('future Google Calendar connection', () => {
  it('mantém tokens fora do core e guarda apenas referências do provedor', async () => {
    const connections = new InMemoryExternalCalendarConnectionRepository();
    const provider: ExternalCalendarProviderPort = {
      beginAuthorization: async () => ({ authorizationUrl: 'https://accounts.google.test/oauth', stateReference: 'state-1' }),
      completeAuthorization: async () => ({ providerAccountReference: 'google-account-ref', calendarId: 'primary' }),
      upsertAppointment: async () => ({ providerEventId: 'event-1' }),
      removeAppointment: async () => undefined,
      pullChanges: async () => ({ changedEventIds: [] }),
    };
    const pending = await beginGoogleCalendarConnection(
      { connections, provider }, actor,
      { connectionId: 'connection-1', professionalId, redirectUri: 'https://app.example.com/oauth/google', occurredAt: '2026-08-01T10:00:00.000Z' }
    );
    expect(pending.connection.status).toBe('pending');
    const connected = await completeGoogleCalendarConnection(
      { connections, provider },
      { organizationId, professionalId, code: 'oauth-code-received-server-side', stateReference: 'state-1', occurredAt: '2026-08-01T10:01:00.000Z' }
    );
    expect(connected).toMatchObject({ status: 'connected', provider: 'google_calendar', calendarId: 'primary' });
    expect(connected).not.toHaveProperty('accessToken');
    expect(connected).not.toHaveProperty('refreshToken');
  });
});
