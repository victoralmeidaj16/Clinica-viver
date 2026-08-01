import { describe, expect, it } from 'vitest';
import {
  buildPreSessionBriefing,
  createOrganization,
  createPatientProfile,
  createProfessionalProfile,
  scheduleAppointment,
  schedulePreSessionCheckInCommand,
  submitPreSessionCheckInCommand,
  InMemoryAppointmentRepository,
  InMemoryPreSessionCheckInRepository,
} from './index';

describe('Fluxo e Briefing Clínico de Pré-Sessão', () => {
  const organizationId = 'org-demo';
  const patientId = 'patient-1';
  const professionalId = 'professional-1';
  const appointmentId = 'appointment-test-1';
  const checkInId = 'checkin-test-1';
  const createdAt = '2026-07-31T12:00:00.000Z';
  const commandMetadata = (suffix: string) => ({
    actorUserId: 'user-demo',
    occurredAt: createdAt,
    correlationId: `corr-${suffix}`,
    commandId: `cmd-${suffix}`,
  });

  const organization = createOrganization({
    id: organizationId,
    type: 'clinic',
    displayName: 'Clínica Demo',
    timezone: 'America/Sao_Paulo',
    createdAt,
  });

  const professional = createProfessionalProfile({
    id: professionalId,
    organizationId,
    userId: 'user-demo',
    displayName: 'Dra. Camila',
    councilType: 'CRP',
    councilRegistration: '06/12345',
    specialties: ['TCC'],
    createdAt,
  });

  const patient = createPatientProfile({
    id: patientId,
    organizationId,
    displayName: 'Mariana Costa',
    primaryProfessionalId: professionalId,
    assignedProfessionalIds: [professionalId],
    createdAt,
  });

  const appointment = scheduleAppointment(
    {
      id: appointmentId,
      organizationId,
      patientId,
      professionalId,
      startsAt: '2026-08-03T12:00:00.000Z',
      endsAt: '2026-08-03T12:50:00.000Z',
      timezone: organization.timezone,
      mode: 'video',
      reminders: [],
      createdAt,
    },
    { actorUserId: professional.userId, occurredAt: createdAt, correlationId: 'seed' }
  ).appointment;

  const staffActor = {
    actorType: 'staff' as const,
    organizationId,
    userId: professional.userId,
    membershipId: 'mem-1',
    membershipStatus: 'active' as const,
    roles: ['professional' as const],
    professionalProfileId: professionalId,
  };

  const patientActor = {
    actorType: 'patient' as const,
    organizationId,
    userId: 'user-patient-1',
    patientId,
  };

  it('permite agendar e submeter um check-in pré-sessão com tópicos opcionais', async () => {
    const checkIns = new InMemoryPreSessionCheckInRepository();
    const appointments = new InMemoryAppointmentRepository([appointment]);

    await schedulePreSessionCheckInCommand(
      { checkIns, appointments },
      staffActor,
      {
        id: checkInId,
        appointmentId,
        availableFrom: createdAt,
        expiresAt: '2026-08-03T12:00:00.000Z',
      },
      commandMetadata('sched')
    );

    const submitResult = await submitPreSessionCheckInCommand(
      { checkIns },
      patientActor,
      checkInId,
      {
        topicsToDiscuss: 'Quero conversar sobre estratégias para gerenciar a ansiedade no trabalho.',
        moodLevel: 3,
      },
      commandMetadata('sub')
    );

    expect(submitResult.checkIn.status).toBe('submitted');
    expect(submitResult.checkIn.response?.topicsToDiscuss).toBe(
      'Quero conversar sobre estratégias para gerenciar a ansiedade no trabalho.'
    );

    const briefing = buildPreSessionBriefing(submitResult.checkIn);
    expect(briefing.reviewRequired).toBe(false);
    expect(briefing.topicsToDiscuss).toContain('ansiedade no trabalho');
  });

  it('sinaliza revisão necessária quando o paciente relata humor nível 1 (muito baixo)', async () => {
    const checkIns = new InMemoryPreSessionCheckInRepository();
    const appointments = new InMemoryAppointmentRepository([appointment]);

    await schedulePreSessionCheckInCommand(
      { checkIns, appointments },
      staffActor,
      {
        id: checkInId,
        appointmentId,
        availableFrom: createdAt,
        expiresAt: '2026-08-03T12:00:00.000Z',
      },
      commandMetadata('sched-2')
    );

    const submitResult = await submitPreSessionCheckInCommand(
      { checkIns },
      patientActor,
      checkInId,
      {
        moodLevel: 1,
      },
      commandMetadata('sub-2')
    );

    expect(submitResult.checkIn.status).toBe('review_required');
    expect(submitResult.checkIn.reviewReasons).toContain('very_low_mood');

    const briefing = buildPreSessionBriefing(submitResult.checkIn);
    expect(briefing.reviewRequired).toBe(true);
    expect(briefing.reviewReasons).toContain('very_low_mood');
  });
});
