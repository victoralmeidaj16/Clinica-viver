import {
  InMemoryAppointmentRepository, InMemoryClinicalRecordRepository,
  InMemoryClinicalSessionRepository, InMemoryClinicalTimelineRepository,
  InMemoryCommunicationAudit, InMemoryIdentityRepository,
  InMemoryFinancialRepository, InMemoryNotificationRepository, addCareTask,
  createCarePlan, createFinancialCharge, createOrganization, createPatientProfile,
  createProfessionalProfile, scheduleAppointment, type CommunicationConsent,
  type CarePlan, type CommunicationPreference, type OrganizationMembership,
} from '@thats-life/core';
import { seedSessionAwaitingReview } from './sessionSeed';

interface DemoApplicationState {
  identities: InMemoryIdentityRepository;
  appointments: InMemoryAppointmentRepository;
  sessions: InMemoryClinicalSessionRepository;
  records: InMemoryClinicalRecordRepository;
  timeline: InMemoryClinicalTimelineRepository;
  notifications: InMemoryNotificationRepository;
  communicationAudit: InMemoryCommunicationAudit;
  preferences: CommunicationPreference[];
  consents: CommunicationConsent[];
  carePlans: CarePlan[];
  financial: InMemoryFinancialRepository;
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
    createPatientProfile({ id: 'patient-1', organizationId: organization.id, displayName: 'Marina Costa', primaryProfessionalId: professional.id, assignedProfessionalIds: [professional.id], createdAt }),
    createPatientProfile({ id: 'patient-2', organizationId: organization.id, displayName: 'Lucas Ribeiro', primaryProfessionalId: professional.id, assignedProfessionalIds: [professional.id], createdAt }),
    createPatientProfile({ id: 'patient-3', organizationId: organization.id, displayName: 'Ana Souza', primaryProfessionalId: professional.id, assignedProfessionalIds: [professional.id], createdAt }),
  ];
  const rows = [
    ['appointment-1', 'patient-1', '2026-08-03T12:00:00.000Z', '2026-08-03T12:50:00.000Z'],
    ['appointment-2', 'patient-2', '2026-08-03T14:00:00.000Z', '2026-08-03T14:50:00.000Z'],
  ] as const;
  const appointments = rows.map(([id, patientId, startsAt, endsAt]) => scheduleAppointment({ id, organizationId: organization.id, patientId, professionalId: professional.id, startsAt, endsAt, timezone: organization.timezone, mode: 'video', reminders: [{ id: `${id}-reminder`, channel: 'whatsapp', minutesBefore: 60 }], createdAt }, { actorUserId: professional.userId, occurredAt: createdAt, correlationId: `seed-${id}` }).appointment);
  const carePlan = addCareTask(createCarePlan({ id: 'plan-1', organizationId: organization.id, patientId: 'patient-1', professionalId: professional.id, goals: [{ id: 'goal-1', title: 'Construir rotina sustentável de autocuidado', status: 'active' }], createdAt }), { id: 'task-1', title: 'Registrar três momentos positivos do dia', dueAt: '2026-08-04T23:59:00.000Z' }, createdAt);
  const charge = createFinancialCharge({ id: 'charge-1', organizationId: organization.id, sessionId: 'session-0', patientId: 'patient-1', professionalId: professional.id, issuedAt: '2026-07-30T12:00:00.000Z', dueAt: '2026-08-05T23:59:00.000Z', amountCents: 25000, createdAt: '2026-07-30T12:00:00.000Z' });
  const seeded = seedSessionAwaitingReview({
    sessionId: 'session-1', recordId: 'record-1', organizationId: organization.id, patientId: 'patient-1',
    professionalId: professional.id, actorUserId: professional.userId,
    scheduledStart: '2026-07-31T13:00:00.000Z', scheduledEnd: '2026-07-31T13:50:00.000Z', createdAt,
  });
  return {
    identities: new InMemoryIdentityRepository({ organizations: [organization], memberships: [membership], professionals: [professional], patients }),
    appointments: new InMemoryAppointmentRepository(appointments), notifications: new InMemoryNotificationRepository(), communicationAudit: new InMemoryCommunicationAudit(),
    sessions: new InMemoryClinicalSessionRepository([seeded.session]), records: new InMemoryClinicalRecordRepository([seeded.record]),
    timeline: new InMemoryClinicalTimelineRepository(),
    preferences: patients.map((patient) => ({ organizationId: organization.id, patientId: patient.id, enabledChannels: ['whatsapp'], disabledCategories: [], updatedAt: createdAt })),
    consents: patients.map((patient) => ({ id: `consent-${patient.id}`, organizationId: organization.id, patientId: patient.id, channel: 'whatsapp', status: 'granted', policyVersion: '2026-07', capturedAt: createdAt })),
    carePlans: [carePlan], financial: new InMemoryFinancialRepository({ charges: [charge] }),
  };
}

export function getApplicationStore() { globalStore.__thatsLifeApplication ??= createState(); return globalStore.__thatsLifeApplication; }
