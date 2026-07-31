import { describe, expect, it } from 'vitest';
import type { PatientAccessContext, StaffAccessContext } from '../identity';
import {
  InMemoryAppointmentRepository,
  scheduleAppointment,
  type AppointmentCommandMetadata,
} from '../scheduling';
import {
  buildPreSessionBriefing,
  InMemoryPreSessionCheckInRepository,
  reviewPreSessionCheckIn,
  schedulePreSessionCheckIn,
  schedulePreSessionCheckInCommand,
  startPreSessionCheckIn,
  submitPreSessionCheckIn,
  submitPreSessionCheckInCommand,
  type PreSessionCommandMetadata,
} from './index';

const organizationId = 'org-1';
const patientId = 'patient-1';
const professionalId = 'professional-1';

const staff: StaffAccessContext = {
  actorType: 'staff',
  organizationId,
  userId: 'user-professional',
  membershipId: 'membership-1',
  membershipStatus: 'active',
  roles: ['professional'],
  professionalProfileId: professionalId,
};

const patient: PatientAccessContext = {
  actorType: 'patient',
  organizationId,
  userId: 'user-patient',
  patientId,
};

function metadata(
  occurredAt: string,
  correlationId = `correlation-${occurredAt}`
): PreSessionCommandMetadata {
  return { actorUserId: patient.userId, occurredAt, correlationId };
}

function scheduled() {
  return schedulePreSessionCheckIn(
    {
      id: 'check-in-1',
      organizationId,
      appointmentId: 'appointment-1',
      patientId,
      professionalId,
      availableFrom: '2026-08-04T14:00:00.000Z',
      expiresAt: '2026-08-05T14:00:00.000Z',
      createdAt: '2026-08-04T14:00:00.000Z',
    },
    metadata('2026-08-04T14:00:00.000Z')
  ).checkIn;
}

describe('pre-session check-in aggregate', () => {
  it('aceita o campo de assuntos vazio sem impedir o envio', () => {
    const started = startPreSessionCheckIn(
      scheduled(),
      metadata('2026-08-04T14:01:00.000Z')
    ).checkIn;
    const result = submitPreSessionCheckIn(
      started,
      {
        topicsToDiscuss: '   ',
        assessment: {
          responseId: 'response-1',
          instrumentCode: 'GAD-7',
          totalScore: 7,
          severityLabel: 'Leve',
          hasRiskAlert: false,
        },
      },
      metadata('2026-08-04T14:05:00.000Z')
    );

    expect(result.checkIn.status).toBe('submitted');
    expect(result.checkIn.response?.topicsToDiscuss).toBeUndefined();
    expect(result.events[0].metadata).toMatchObject({
      hasTopicsToDiscuss: false,
    });
  });

  it('preserva o texto informado e o mantém fora dos eventos', () => {
    const topics = 'Sono ruim desde domingo.\nConflito com a liderança.';
    const result = submitPreSessionCheckIn(
      scheduled(),
      {
        moodLevel: 3,
        topicsToDiscuss: topics,
      },
      metadata('2026-08-04T14:05:00.000Z')
    );

    expect(result.checkIn.response?.topicsToDiscuss).toBe(topics);
    expect(JSON.stringify(result.events)).not.toContain('Sono ruim');
  });

  it('exige revisão humana para risco e produz briefing sem alterar prontuário', () => {
    const submitted = submitPreSessionCheckIn(
      scheduled(),
      {
        moodLevel: 1,
        topicsToDiscuss: 'Gostaria de falar sobre a semana.',
        assessment: {
          responseId: 'response-risk',
          instrumentCode: 'PHQ-9',
          totalScore: 18,
          severityLabel: 'Moderada a grave',
          hasRiskAlert: true,
          riskAlertReason: 'Resposta positiva em item de risco.',
        },
      },
      metadata('2026-08-04T14:05:00.000Z')
    ).checkIn;

    expect(submitted.status).toBe('review_required');
    expect(submitted.reviewReasons).toEqual([
      'very_low_mood',
      'assessment_risk',
    ]);
    expect(buildPreSessionBriefing(submitted)).toMatchObject({
      reviewRequired: true,
      topicsToDiscuss: 'Gostaria de falar sobre a semana.',
    });

    const reviewed = reviewPreSessionCheckIn(submitted, {
      actorUserId: staff.userId,
      occurredAt: '2026-08-04T14:10:00.000Z',
      correlationId: 'review-1',
    }).checkIn;
    expect(reviewed.status).toBe('reviewed');
  });

  it('limita o texto opcional a mil caracteres', () => {
    expect(() =>
      submitPreSessionCheckIn(
        scheduled(),
        { moodLevel: 3, topicsToDiscuss: 'a'.repeat(1_001) },
        metadata('2026-08-04T14:05:00.000Z')
      )
    ).toThrow('no máximo 1000 caracteres');
  });
});

describe('pre-session check-in commands and repository', () => {
  it('vincula ao agendamento, isola o paciente e repete comandos com segurança', async () => {
    const appointmentMetadata: AppointmentCommandMetadata = {
      actorUserId: staff.userId,
      occurredAt: '2026-08-01T10:00:00.000Z',
      correlationId: 'appointment-create',
    };
    const appointment = scheduleAppointment(
      {
        id: 'appointment-1',
        organizationId,
        patientId,
        professionalId,
        startsAt: '2026-08-05T14:00:00.000Z',
        endsAt: '2026-08-05T14:50:00.000Z',
        timezone: 'America/Sao_Paulo',
        mode: 'video',
        reminders: [],
        createdAt: appointmentMetadata.occurredAt,
      },
      appointmentMetadata
    ).appointment;
    const appointments = new InMemoryAppointmentRepository([appointment]);
    const checkIns = new InMemoryPreSessionCheckInRepository();

    const created = await schedulePreSessionCheckInCommand(
      { appointments, checkIns },
      staff,
      {
        id: 'check-in-1',
        appointmentId: appointment.id,
        availableFrom: '2026-08-04T14:00:00.000Z',
        expiresAt: appointment.startsAt,
      },
      {
        actorUserId: staff.userId,
        occurredAt: '2026-08-04T14:00:00.000Z',
        correlationId: 'check-in-create',
        commandId: 'command-create',
      }
    );
    expect(created.checkIn.status).toBe('available');

    const response = { moodLevel: 4 as const, topicsToDiscuss: undefined };
    const command = {
      actorUserId: patient.userId,
      occurredAt: '2026-08-04T14:05:00.000Z',
      correlationId: 'check-in-submit',
      commandId: 'command-submit',
    };
    const first = await submitPreSessionCheckInCommand(
      { checkIns },
      patient,
      created.checkIn.id,
      response,
      command
    );
    const replay = await submitPreSessionCheckInCommand(
      { checkIns },
      patient,
      created.checkIn.id,
      response,
      command
    );
    expect(first.idempotentReplay).toBe(false);
    expect(replay.idempotentReplay).toBe(true);
    expect(checkIns.listOutboxEvents()).toHaveLength(2);

    await expect(
      submitPreSessionCheckInCommand(
        { checkIns },
        { ...patient, patientId: 'other-patient' },
        created.checkIn.id,
        response,
        { ...command, commandId: 'other-command' }
      )
    ).rejects.toThrow('patient_scope_mismatch');
  });
});
