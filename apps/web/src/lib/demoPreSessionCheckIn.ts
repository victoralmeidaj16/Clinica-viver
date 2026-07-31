import {
  buildPreSessionBriefing,
  schedulePreSessionCheckIn,
  submitPreSessionCheckIn,
  type PreSessionBriefing,
} from '@thats-life/core';

const occurredAt = '2026-08-04T18:20:00.000Z';
const scheduled = schedulePreSessionCheckIn(
  {
    id: 'demo-pre-session-patient-1',
    organizationId: 'demo-org-01',
    appointmentId: 'demo-appointment-patient-1',
    patientId: 'patient-1',
    professionalId: 'psi-demo-01',
    availableFrom: '2026-08-04T17:00:00.000Z',
    expiresAt: '2026-08-05T17:00:00.000Z',
    createdAt: '2026-08-04T17:00:00.000Z',
  },
  {
    actorUserId: 'demo-system',
    occurredAt: '2026-08-04T17:00:00.000Z',
    correlationId: 'demo-pre-session-scheduled',
  }
).checkIn;

const submitted = submitPreSessionCheckIn(
  scheduled,
  {
    moodLevel: 2,
    topicsToDiscuss:
      'Tenho dormido mal e gostaria de conversar sobre a sobrecarga no trabalho.',
    assessment: {
      responseId: 'demo-gad7-response-pac-01',
      instrumentCode: 'GAD-7',
      totalScore: 12,
      severityLabel: 'Moderada',
      hasRiskAlert: false,
    },
  },
  {
    actorUserId: 'demo-patient-user-01',
    occurredAt,
    correlationId: 'demo-pre-session-submitted',
  }
).checkIn;

export const DEMO_PRE_SESSION_BRIEFINGS: Readonly<
  Record<string, PreSessionBriefing>
> = {
  'patient-1': buildPreSessionBriefing(submitted),
};
