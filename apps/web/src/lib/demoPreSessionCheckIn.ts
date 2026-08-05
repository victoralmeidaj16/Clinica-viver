import {
  buildPreSessionBriefing,
  schedulePreSessionCheckIn,
  submitPreSessionCheckIn,
  type PreSessionBriefing,
} from '@thats-life/core';

const occurredAt = '2026-08-04T18:20:00.000Z';

// Patient 1 Check-In (Mariana)
const checkIn1 = submitPreSessionCheckIn(
  schedulePreSessionCheckIn(
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
    { actorUserId: 'demo-system', occurredAt: '2026-08-04T17:00:00.000Z', correlationId: 'demo-pre-session-scheduled-1' }
  ).checkIn,
  {
    moodLevel: 2,
    topicsToDiscuss: 'Tenho dormido mal e gostaria de conversar sobre a sobrecarga no trabalho e alinhamento com meu gerente.',
    assessment: {
      responseId: 'demo-gad7-response-pac-01',
      instrumentCode: 'GAD-7',
      totalScore: 12,
      severityLabel: 'Ansiedade Moderada',
      hasRiskAlert: false,
    },
  },
  { actorUserId: 'demo-patient-user-01', occurredAt, correlationId: 'demo-pre-session-submitted-1' }
).checkIn;

// Patient 2 Check-In (Lucas)
const checkIn2 = submitPreSessionCheckIn(
  schedulePreSessionCheckIn(
    {
      id: 'demo-pre-session-patient-2',
      organizationId: 'demo-org-01',
      appointmentId: 'demo-appointment-patient-2',
      patientId: 'patient-2',
      professionalId: 'psi-demo-01',
      availableFrom: '2026-08-04T17:00:00.000Z',
      expiresAt: '2026-08-05T17:00:00.000Z',
      createdAt: '2026-08-04T17:00:00.000Z',
    },
    { actorUserId: 'demo-system', occurredAt: '2026-08-04T17:00:00.000Z', correlationId: 'demo-pre-session-scheduled-2' }
  ).checkIn,
  {
    moodLevel: 4,
    topicsToDiscuss: 'Refleti sobre as opções da transição de carreira e gostaria de discutir a proposta da nova empresa.',
    assessment: {
      responseId: 'demo-phq9-response-pac-02',
      instrumentCode: 'PHQ-9',
      totalScore: 4,
      severityLabel: 'Sintomas Mínimos',
      hasRiskAlert: false,
    },
  },
  { actorUserId: 'demo-patient-user-02', occurredAt, correlationId: 'demo-pre-session-submitted-2' }
).checkIn;

// Patient 3 Check-In (Beatriz)
const checkIn3 = submitPreSessionCheckIn(
  schedulePreSessionCheckIn(
    {
      id: 'demo-pre-session-patient-3',
      organizationId: 'demo-org-01',
      appointmentId: 'demo-appointment-patient-3',
      patientId: 'patient-3',
      professionalId: 'psi-demo-01',
      availableFrom: '2026-08-04T17:00:00.000Z',
      expiresAt: '2026-08-05T17:00:00.000Z',
      createdAt: '2026-08-04T17:00:00.000Z',
    },
    { actorUserId: 'demo-system', occurredAt: '2026-08-04T17:00:00.000Z', correlationId: 'demo-pre-session-scheduled-3' }
  ).checkIn,
  {
    moodLevel: 3,
    topicsToDiscuss: 'Consegui usar a técnica de aceitação nos estudos, mas ainda sinto desatenção em momentos de estresse.',
    assessment: {
      responseId: 'demo-asrs18-response-pac-03',
      instrumentCode: 'GAD-7',
      totalScore: 14,
      severityLabel: 'Ansiedade Moderada',
      hasRiskAlert: false,
    },
  },
  { actorUserId: 'demo-patient-user-03', occurredAt, correlationId: 'demo-pre-session-submitted-3' }
).checkIn;

export const DEMO_PRE_SESSION_BRIEFINGS: Readonly<
  Record<string, PreSessionBriefing>
> = {
  'patient-1': buildPreSessionBriefing(checkIn1),
  'pac_01': buildPreSessionBriefing(checkIn1),
  'patient-2': buildPreSessionBriefing(checkIn2),
  'pac_02': buildPreSessionBriefing(checkIn2),
  'patient-3': buildPreSessionBriefing(checkIn3),
  'pac_03': buildPreSessionBriefing(checkIn3),
};
