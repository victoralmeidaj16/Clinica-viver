import {
  InMemoryAppointmentRepository, InMemoryClinicalRecordRepository,
  InMemoryClinicalSessionRepository, InMemoryClinicalTimelineRepository,
  InMemoryClinicalTimelineAccessAudit, InMemoryCommunicationAudit, InMemoryIdentityRepository,
  InMemoryFinancialRepository, InMemoryNotificationRepository, InMemoryPreSessionCheckInRepository, addCareTask,
  createCarePlan, createFinancialCharge, createIdentityUser, createOrganization, createOrganizationMembership, createPatientProfile,
  createProfessionalProfile, createClinicalTimelineEntry, scheduleAppointment, type AppointmentRepository,
  type CommunicationConsent, type IdentityRepository,
  type CarePlan, type CommunicationPreference, type OrganizationMembership,
  type MoodCheckIn, type PatientHandoff, type PreSessionCheckIn,
} from '@thats-life/core';
import { isMysqlConfigured } from '@/server/oci/runtime';
import { MysqlAppointmentRepository } from '@/server/persistence/mysql/appointmentRepository';
import { MysqlIdentityRepository } from '@/server/persistence/mysql/identityRepository';
import { seedSessionAwaitingReview } from './sessionSeed';
import { readSnapshot, writeSnapshot, type PersistedSnapshot } from './persistence';

interface DemoApplicationState {
  identities: IdentityRepository;
  appointments: AppointmentRepository;
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
  const adminUser = createIdentityUser({ id: 'admin-demo', displayName: 'Coordenação Viver Mais', normalizedEmail: 'admin@vivermais.local', createdAt });
  const adminMembership = { ...createOrganizationMembership({ id: 'membership-admin-demo', organizationId: organization.id, userId: adminUser.id, roles: ['owner', 'admin'], createdAt }), status: 'active' as const };
  // Consultório autônomo: a mesma pessoa atende e fatura. O papel clínico
  // permanece isolado do papel financeiro para que o vínculo com o paciente
  // continue sendo exigido nas permissões clínicas.
  const membership: OrganizationMembership = { id: 'membership-demo', organizationId: organization.id, userId: professional.userId, roles: ['professional', 'billing'], status: 'active', professionalProfileId: professional.id, createdAt, updatedAt: createdAt };
  const patients: ReturnType<typeof createPatientProfile>[] = [];
  const appointments: ReturnType<typeof scheduleAppointment>['appointment'][] = [];
  const deliveredHandoffs: PatientHandoff[] = [];
  const moodLogs: MoodCheckIn[] = [];
  const seededCheckIns: PreSessionCheckIn[] = [];
  const seededTimelineEntries: ReturnType<typeof createClinicalTimelineEntry>[] = [];

  return {
    identities: new InMemoryIdentityRepository({ organizations: [organization], users: [adminUser], memberships: [membership, adminMembership], professionals: [professional], patients: [] }),
    appointments: new InMemoryAppointmentRepository([]), notifications: new InMemoryNotificationRepository(), communicationAudit: new InMemoryCommunicationAudit(),
    sessions: new InMemoryClinicalSessionRepository([]), records: new InMemoryClinicalRecordRepository([]),
    timeline: new InMemoryClinicalTimelineRepository([]),
    timelineAudit: new InMemoryClinicalTimelineAccessAudit(),
    preferences: [],
    consents: [],
    carePlans: [], financial: new InMemoryFinancialRepository({ charges: [] }),
    checkIns: new InMemoryPreSessionCheckInRepository([]),
    moodLogs: [], deliveredHandoffs: [], assessments: [],
  };
}

const DEMO_ORGANIZATION_ID = 'org-demo';
const DEMO_PATIENT_IDS: readonly string[] = [];

/**
 * Reconstrói o estado a partir de um snapshot gravado em disco.
 *
 * A identidade (organização, membros, profissionais, pacientes) não é
 * persistida: ela é a definição da demonstração, não dado produzido por ela.
 * Vem sempre do seed, de modo que ajustes em papéis e permissões passem a valer
 * sem exigir que se apague o estado acumulado.
 */
function stateFromSnapshot(snapshot: PersistedSnapshot): DemoApplicationState {
  const seed = createState();
  return {
    ...seed,
    appointments: new InMemoryAppointmentRepository(snapshot.appointments),
    sessions: new InMemoryClinicalSessionRepository(snapshot.sessions),
    records: new InMemoryClinicalRecordRepository(snapshot.records),
    timeline: new InMemoryClinicalTimelineRepository(snapshot.timeline),
    checkIns: new InMemoryPreSessionCheckInRepository(snapshot.checkIns),
    notifications: new InMemoryNotificationRepository(snapshot.notifications),
    financial: new InMemoryFinancialRepository(snapshot.ledger),
    preferences: [...snapshot.preferences],
    consents: [...snapshot.consents],
    carePlans: [...snapshot.carePlans],
    moodLogs: [...snapshot.moodLogs],
    deliveredHandoffs: [...snapshot.deliveredHandoffs],
    assessments: [...snapshot.assessments],
  };
}

/** Lê o estado corrente pelas APIs públicas dos repositórios. */
export async function captureSnapshot(): Promise<PersistedSnapshot> {
  const state = getApplicationStore();
  const organizationId = DEMO_ORGANIZATION_ID;

  const timelinePerPatient = await Promise.all(
    DEMO_PATIENT_IDS.map((patientId) => state.timeline.list({ organizationId, patientId }))
  );

  const [appointments, sessions, records, checkIns, notifications, ledger] = await Promise.all([
    state.appointments.list({ organizationId }),
    state.sessions.list({ organizationId }),
    state.records.list({ organizationId }),
    state.checkIns.list({ organizationId }),
    state.notifications.list({ organizationId }),
    state.financial.getLedger({ organizationId }),
  ]);

  return {
    version: 1,
    savedAt: new Date().toISOString(),
    appointments,
    sessions,
    records,
    timeline: timelinePerPatient.flat(),
    checkIns,
    notifications,
    ledger,
    carePlans: state.carePlans,
    moodLogs: state.moodLogs,
    deliveredHandoffs: state.deliveredHandoffs,
    assessments: state.assessments,
    preferences: state.preferences,
    consents: state.consents,
  };
}

/**
 * Grava o estado corrente. Chamado depois das mutações; falhas de escrita são
 * registradas mas nunca derrubam a requisição — o estado em memória segue
 * válido e a próxima gravação tenta de novo.
 *
 * Com MySQL configurado a chamada é um no-op: o banco é a fonte de verdade dos
 * módulos migrados, e um snapshot parcial em disco só criaria uma segunda
 * versão da mesma agenda, livre para divergir.
 */
export async function persistApplicationState(): Promise<void> {
  if (isMysqlConfigured()) return;
  await writeSnapshot(await captureSnapshot());
}

/**
 * Identidade e agenda no MySQL da OCI; os demais módulos seguem em memória até
 * o 008 trazer o resto do schema.
 *
 * A mistura é deliberada e temporária. O seed continua sendo construído porque
 * ele ainda alimenta prontuário, financeiro, timeline e comunicação — o que
 * muda é de onde vêm paciente, profissional, vínculo e agendamento.
 */
function createMysqlBackedState(): DemoApplicationState {
  return {
    ...createState(),
    identities: new MysqlIdentityRepository(),
    appointments: new MysqlAppointmentRepository(),
  };
}

export function getApplicationStore(): DemoApplicationState {
  if (!globalStore.__thatsLifeApplication) {
    if (isMysqlConfigured()) {
      globalStore.__thatsLifeApplication = createMysqlBackedState();
    } else {
      const snapshot = readSnapshot();
      globalStore.__thatsLifeApplication = snapshot ? stateFromSnapshot(snapshot) : createState();
    }
  }
  return globalStore.__thatsLifeApplication;
}
