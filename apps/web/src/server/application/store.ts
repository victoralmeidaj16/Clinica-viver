import {
  InMemoryAppointmentRepository, InMemoryClinicalRecordRepository,
  InMemoryClinicalSessionRepository, InMemoryClinicalTimelineRepository,
  InMemoryClinicalTimelineAccessAudit, InMemoryCommunicationAudit, InMemoryIdentityRepository,
  InMemoryFinancialRepository, InMemoryNotificationRepository, InMemoryPreSessionCheckInRepository, addCareTask,
  createCarePlan, createFinancialCharge, createOrganization, createPatientProfile,
  createProfessionalProfile, createClinicalTimelineEntry, scheduleAppointment, type CommunicationConsent,
  type CarePlan, type CommunicationPreference, type OrganizationMembership,
  type MoodCheckIn, type PatientHandoff, type PreSessionCheckIn,
} from '@thats-life/core';
import { seedSessionAwaitingReview } from './sessionSeed';

interface DemoApplicationState {
  identities: InMemoryIdentityRepository;
  appointments: InMemoryAppointmentRepository;
  sessions: InMemoryClinicalSessionRepository;
  records: InMemoryClinicalRecordRepository;
  timeline: InMemoryClinicalTimelineRepository;
  timelineAudit: InMemoryClinicalTimelineAccessAudit;
  notifications: InMemoryNotificationRepository;
  communicationAudit: InMemoryCommunicationAudit;
  preferences: CommunicationPreference[];
  consents: CommunicationConsent[];
  carePlans: CarePlan[];
  financial: InMemoryFinancialRepository;
  checkIns: InMemoryPreSessionCheckInRepository;
  moodLogs: MoodCheckIn[];
  deliveredHandoffs: PatientHandoff[];
  assessments: Array<{ id: string; organizationId: string; patientId: string; type: string; answers: Record<string, number>; score: number; completedAt: string }>;
}
interface DemoGlobal { __thatsLifeApplication?: DemoApplicationState; }
const globalStore = globalThis as typeof globalThis & DemoGlobal;
const createdAt = '2026-07-31T12:00:00.000Z';

function createState(): DemoApplicationState {
  const organization = createOrganization({ id: 'org-demo', type: 'clinic', displayName: 'Clínica Thats Life', timezone: 'America/Sao_Paulo', createdAt });
  const professional = createProfessionalProfile({ id: 'professional-1', organizationId: organization.id, userId: 'user-demo', displayName: 'Dra. Camila', councilType: 'CRP', councilRegistration: '06/148293', specialties: ['TCC'], createdAt });
  // Consultório autônomo: a mesma pessoa atende e fatura. O papel clínico
  // permanece isolado do papel financeiro para que o vínculo com o paciente
  // continue sendo exigido nas permissões clínicas.
  const membership: OrganizationMembership = { id: 'membership-demo', organizationId: organization.id, userId: professional.userId, roles: ['professional', 'billing'], status: 'active', professionalProfileId: professional.id, createdAt, updatedAt: createdAt };
  const patients = [
    createPatientProfile({ id: 'patient-1', userId: 'user-patient-demo', organizationId: organization.id, displayName: 'Mariana Costa', primaryProfessionalId: professional.id, assignedProfessionalIds: [professional.id], createdAt }),
    createPatientProfile({ id: 'pac-01', userId: 'user-pac-01', organizationId: organization.id, displayName: 'Mariana Costa', primaryProfessionalId: professional.id, assignedProfessionalIds: [professional.id], createdAt }),
    createPatientProfile({ id: 'patient-2', organizationId: organization.id, displayName: 'Lucas Ribeiro', primaryProfessionalId: professional.id, assignedProfessionalIds: [professional.id], createdAt }),
    createPatientProfile({ id: 'patient-3', organizationId: organization.id, displayName: 'Ana Souza', primaryProfessionalId: professional.id, assignedProfessionalIds: [professional.id], createdAt }),
  ];
  const rows = [
    ['appointment-1', 'patient-1', '2026-08-03T12:00:00.000Z', '2026-08-03T12:50:00.000Z'],
    ['appointment-pac-01', 'pac-01', '2026-08-03T14:00:00.000Z', '2026-08-03T14:50:00.000Z'],
    ['appointment-2', 'patient-2', '2026-08-03T15:00:00.000Z', '2026-08-03T15:50:00.000Z'],
  ] as const;
  const appointments = rows.map(([id, patientId, startsAt, endsAt]) => scheduleAppointment({ id, organizationId: organization.id, patientId, professionalId: professional.id, startsAt, endsAt, timezone: organization.timezone, mode: 'video', reminders: [{ id: `${id}-reminder`, channel: 'whatsapp', minutesBefore: 60 }], createdAt }, { actorUserId: professional.userId, occurredAt: createdAt, correlationId: `seed-${id}` }).appointment);
  
  const basePlan = createCarePlan({ id: 'plan-1', organizationId: organization.id, patientId: 'patient-1', professionalId: professional.id, goals: [{ id: 'goal-1', title: 'Construir rotina sustentável de autocuidado', status: 'active' }], createdAt });
  const carePlan = addCareTask(
    addCareTask(
      addCareTask(basePlan, { id: 'task-1', title: '📝 Preencher RPD ao perceber gatilhos de ansiedade' }, createdAt),
      { id: 'task-2', title: '🧘 Praticar 10 min de respiração diafragmática ao acordar' }, createdAt
    ),
    { id: 'task-3', title: '✉️ Escrever rascunho de alinhamento de demandas com a gerência' }, createdAt
  );

  const basePlanPac01 = createCarePlan({ id: 'plan-pac-01', organizationId: organization.id, patientId: 'pac-01', professionalId: professional.id, goals: [{ id: 'goal-pac-1', title: 'Gestão de ansiedade ocupacional', status: 'active' }], createdAt });
  const carePlanPac01 = addCareTask(
    addCareTask(
      addCareTask(basePlanPac01, { id: 'demo-pac-01-session-01-task-1', title: '📝 Preencher RPD ao perceber gatilhos de ansiedade' }, createdAt),
      { id: 'demo-pac-01-session-01-task-2', title: '🧘 Praticar 10 min de respiração diafragmática ao acordar' }, createdAt
    ),
    { id: 'demo-pac-01-session-01-task-3', title: '✉️ Escrever rascunho de alinhamento de demandas com a gerência' }, createdAt
  );

  const charge = createFinancialCharge({ id: 'charge-1', organizationId: organization.id, sessionId: 'session-0', patientId: 'patient-1', professionalId: professional.id, issuedAt: '2026-07-30T12:00:00.000Z', dueAt: '2026-08-05T23:59:00.000Z', amountCents: 25000, createdAt: '2026-07-30T12:00:00.000Z' });
  const seeded = seedSessionAwaitingReview({
    sessionId: 'session-1', recordId: 'record-1', organizationId: organization.id, patientId: 'patient-1',
    professionalId: professional.id, actorUserId: professional.userId,
    scheduledStart: '2026-07-31T13:00:00.000Z', scheduledEnd: '2026-07-31T13:50:00.000Z', createdAt,
  });

  const deliveredHandoffs: PatientHandoff[] = [
    {
      schemaVersion: 1,
      patientId: 'patient-1',
      sessionId: 'session-prev',
      summary: 'Nesta sessão vocês trabalharam estratégias para lidar com a ansiedade em situações profissionais, reconhecer limites na rotina e fortalecer formas mais assertivas de comunicação.',
      tasks: [
        { id: 'task-1', title: '📝 Preencher RPD ao perceber gatilhos de ansiedade', completed: true },
        { id: 'task-2', title: '🧘 Praticar 10 min de respiração diafragmática ao acordar', completed: false },
        { id: 'task-3', title: '✉️ Escrever rascunho de alinhamento de demandas com a gerência', completed: false },
      ],
      nextSessionLabel: 'Quarta-feira, 05 de Agosto às 14:00',
      professionalName: 'Dra. Camila',
      status: 'delivered',
      humanReviewRequired: true,
      safetyWarnings: [],
      approvedBy: professional.userId,
      approvedAt: createdAt,
      deliveredAt: createdAt,
    },
    {
      schemaVersion: 1,
      patientId: 'pac-01',
      sessionId: 'demo-pac-01-session-01',
      summary: 'Nesta sessão vocês trabalharam estratégias para lidar com a ansiedade em situações profissionais, reconhecer limites na rotina e fortalecer formas mais assertivas de comunicação.',
      tasks: [
        { id: 'demo-pac-01-session-01-task-1', title: '📝 Preencher RPD ao perceber gatilhos de ansiedade', completed: true },
        { id: 'demo-pac-01-session-01-task-2', title: '🧘 Praticar 10 min de respiração diafragmática ao acordar', completed: false },
        { id: 'demo-pac-01-session-01-task-3', title: '✉️ Escrever rascunho de alinhamento de demandas com a gerência', completed: false },
      ],
      nextSessionLabel: 'Quarta-feira, 05 de Agosto às 14:00',
      professionalName: 'Dra. Camila Vasconcelos',
      status: 'delivered',
      humanReviewRequired: true,
      safetyWarnings: [],
      approvedBy: professional.userId,
      approvedAt: createdAt,
      deliveredAt: createdAt,
    },
  ];

  const moodLogs: MoodCheckIn[] = [
    { id: 'mood-1', organizationId: organization.id, patientId: 'patient-1', recordedAt: '2026-07-30T20:00:00.000Z', level: 4, emotions: ['Tranquila', 'Focada'], note: 'Dia produtivo no trabalho.' },
    { id: 'mood-2', organizationId: organization.id, patientId: 'patient-1', recordedAt: '2026-07-31T09:00:00.000Z', level: 3, emotions: ['Ansiosa'], note: 'Apresentação importante à tarde.' },
    { id: 'mood-pac-1', organizationId: organization.id, patientId: 'pac-01', recordedAt: '2026-07-30T20:00:00.000Z', level: 4, emotions: ['Tranquila', 'Focada'], note: 'Dia produtivo no trabalho.' },
  ];

  const seededCheckIns: PreSessionCheckIn[] = [
    {
      schemaVersion: 1,
      id: 'checkin-appointment-1',
      organizationId: organization.id,
      appointmentId: 'appointment-1',
      patientId: 'patient-1',
      professionalId: professional.id,
      availableFrom: '2026-08-01T00:00:00.000Z',
      expiresAt: '2026-08-03T12:00:00.000Z',
      status: 'submitted',
      response: {
        moodLevel: 3,
        topicsToDiscuss: 'Gostaria de falar sobre estratégias para gerenciar a sobrecarga no trabalho e ansiedade com reuniões.',
        assessment: {
          responseId: 'resp-1',
          instrumentCode: 'GAD-7',
          totalScore: 8,
          severityLabel: 'Ansiedade leve',
          hasRiskAlert: false,
        },
      },
      reviewReasons: [],
      submittedAt: '2026-08-02T18:00:00.000Z',
      version: 2,
      createdAt,
      updatedAt: createdAt,
    },
    {
      schemaVersion: 1,
      id: 'checkin-appointment-pac-01',
      organizationId: organization.id,
      appointmentId: 'appointment-pac-01',
      patientId: 'pac-01',
      professionalId: professional.id,
      availableFrom: '2026-08-01T00:00:00.000Z',
      expiresAt: '2026-08-03T14:00:00.000Z',
      status: 'available',
      reviewReasons: [],
      version: 1,
      createdAt,
      updatedAt: createdAt,
    },
  ];

  const seededTimelineEntries = [
    createClinicalTimelineEntry({
      id: 'timeline-entry-1',
      organizationId: organization.id,
      patientId: 'patient-1',
      authorizedProfessionalIds: [professional.id],
      category: 'clinical_record',
      importance: 'milestone',
      occurredAt: '2026-07-30T13:00:00.000Z',
      recordedAt: createdAt,
      title: 'Prontuário Aprovado — Sessão de Anamnese & Ansiedade',
      summary: 'Evolução clínica SOAP aprovada. Trabalhadas estratégias de regulação emocional e manejo de ansiedade ocupacional.',
      evidenceExcerpt: 'Paciente relata oscilações de ansiedade ligadas à rotina de trabalho e reuniões. Aplicadas técnicas de respiração diafragmática.',
      tags: ['ansiedade', 'trabalho', 'soap', 'anamnese'],
      evidence: {
        sourceType: 'clinical_record_revision',
        sourceId: 'record-prev',
        sourceVersion: 1,
        sourceRevisionId: 'record-prev-rev-1',
        sourceField: 'content.assessment',
        contentHashSha256: 'a1b2c3d4e5f60123456789abcdef0123456789abcdef0123456789abcdef0123',
      },
    }),
    createClinicalTimelineEntry({
      id: 'timeline-entry-2',
      organizationId: organization.id,
      patientId: 'patient-1',
      authorizedProfessionalIds: [professional.id],
      category: 'assessment',
      importance: 'routine',
      occurredAt: '2026-07-30T12:00:00.000Z',
      recordedAt: createdAt,
      title: 'Escala GAD-7 — Ansiedade Leve',
      summary: 'Resultado da avaliação pré-sessão. Escore total 8 de 21 pontos (Ansiedade leve). Sem alertas de risco elevado.',
      evidenceExcerpt: 'Escore total: 8 pontos. Sintomas moderados nos últimos 14 dias.',
      tags: ['gad-7', 'escala', 'ansiedade'],
      evidence: {
        sourceType: 'assessment_response',
        sourceId: 'resp-1',
        sourceField: 'totalScore',
      },
    }),
    createClinicalTimelineEntry({
      id: 'timeline-entry-3',
      organizationId: organization.id,
      patientId: 'pac-01',
      authorizedProfessionalIds: [professional.id],
      category: 'clinical_record',
      importance: 'milestone',
      occurredAt: '2026-07-30T13:00:00.000Z',
      recordedAt: createdAt,
      title: 'Prontuário Aprovado — Ansiedade Ocupacional',
      summary: 'Evolução clínica SOAP aprovada. Trabalhadas estratégias de regulação emocional e respiração diafragmática.',
      evidenceExcerpt: 'Paciente relata oscilações de ansiedade ligadas à rotina de trabalho. Aplicadas práticas de respiração diafragmática.',
      tags: ['ansiedade', 'trabalho', 'soap'],
      evidence: {
        sourceType: 'clinical_record_revision',
        sourceId: 'demo-pac-01-record',
        sourceVersion: 1,
        sourceRevisionId: 'demo-pac-01-rev-1',
        sourceField: 'content.assessment',
        contentHashSha256: '9f8e7d6c5b4a0123456789abcdef0123456789abcdef0123456789abcdef0123',
      },
    }),
  ];

  return {
    identities: new InMemoryIdentityRepository({ organizations: [organization], memberships: [membership], professionals: [professional], patients }),
    appointments: new InMemoryAppointmentRepository(appointments), notifications: new InMemoryNotificationRepository(), communicationAudit: new InMemoryCommunicationAudit(),
    sessions: new InMemoryClinicalSessionRepository([seeded.session]), records: new InMemoryClinicalRecordRepository([seeded.record]),
    timeline: new InMemoryClinicalTimelineRepository(seededTimelineEntries),
    timelineAudit: new InMemoryClinicalTimelineAccessAudit(),
    preferences: patients.map((patient) => ({ organizationId: organization.id, patientId: patient.id, enabledChannels: ['whatsapp'], disabledCategories: [], updatedAt: createdAt })),
    consents: patients.map((patient) => ({ id: `consent-${patient.id}`, organizationId: organization.id, patientId: patient.id, channel: 'whatsapp', status: 'granted', policyVersion: '2026-07', capturedAt: createdAt })),
    carePlans: [carePlan, carePlanPac01], financial: new InMemoryFinancialRepository({ charges: [charge] }),
    checkIns: new InMemoryPreSessionCheckInRepository(seededCheckIns),
    moodLogs, deliveredHandoffs, assessments: [],
  };
}

export function getApplicationStore() { globalStore.__thatsLifeApplication ??= createState(); return globalStore.__thatsLifeApplication; }
