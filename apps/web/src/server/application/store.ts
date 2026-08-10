import {
  InMemoryAppointmentRepository, InMemoryClinicalRecordRepository,
  InMemoryClinicalSessionRepository, InMemoryClinicalTimelineRepository,
  InMemoryClinicalTimelineAccessAudit, InMemoryCommunicationAudit, InMemoryIdentityRepository,
  InMemoryFinancialRepository, InMemoryNotificationRepository,
  createFinancialCharge, createIdentityUser, createOrganization, createOrganizationMembership, createPatientProfile,
  createProfessionalProfile, createClinicalTimelineEntry, scheduleAppointment, type AppointmentRepository,
  type ClinicalRecordRepository, type ClinicalSessionRepository,
  type ClinicalTimelineAccessAuditPort, type ClinicalTimelineRepository,
  type CommunicationConsent, type FinancialRepository, type IdentityRepository,
  type CommunicationPreference, type OrganizationMembership,
  type PatientHandoff,
} from '@thats-life/core';
import { isMysqlConfigured } from '@/server/oci/runtime';
import { MysqlAppointmentRepository } from '@/server/persistence/mysql/appointmentRepository';
import { MysqlIdentityRepository } from '@/server/persistence/mysql/identityRepository';
import { MysqlClinicalAccessAudit } from '@/server/persistence/mysql/clinicalAccessAuditRepository';
import { MysqlClinicalRecordRepository } from '@/server/persistence/mysql/clinicalRecordRepository';
import { MysqlClinicalSessionRepository } from '@/server/persistence/mysql/clinicalSessionRepository';
import { MysqlClinicalTimelineRepository } from '@/server/persistence/mysql/clinicalTimelineRepository';
import { MysqlFinancialRepository } from '@/server/persistence/mysql/financialRepository';
import { seedSessionAwaitingReview } from './sessionSeed';
import { readSnapshot, writeSnapshot, type PersistedSnapshot } from './persistence';

/**
 * Portas, não implementações.
 *
 * Os campos abaixo eram tipados pelas classes em memória, o que impedia trocar
 * o adaptador sem tocar em todo o resto — declarar a porta é o que torna a
 * migração para o MySQL uma troca de linha em `createMysqlBackedState`.
 * `communicationAudit` continua concreto porque `communicationService` usa
 * `listEvents()`, que só existe na versão em memória e ainda não foi migrada.
 */
interface DemoApplicationState {
  identities: IdentityRepository;
  appointments: AppointmentRepository;
  sessions: ClinicalSessionRepository;
  records: ClinicalRecordRepository;
  timeline: ClinicalTimelineRepository;
  timelineAudit: ClinicalTimelineAccessAuditPort;
  notifications: InMemoryNotificationRepository;
  communicationAudit: InMemoryCommunicationAudit;
  preferences: CommunicationPreference[];
  consents: CommunicationConsent[];
  financial: FinancialRepository;
  deliveredHandoffs: PatientHandoff[];
  assessments: Array<{ id: string; organizationId: string; patientId: string; type: string; answers: Record<string, number>; score: number; completedAt: string }>;
}
interface DemoGlobal { __thatsLifeApplication?: DemoApplicationState; }
const globalStore = globalThis as typeof globalThis & DemoGlobal;
const createdAt = '2026-07-31T12:00:00.000Z';

function applicationOrganizationId(): string {
  return process.env.NEXT_PUBLIC_ORGANIZATION_ID?.trim() || 'org-demo';
}

function createState(): DemoApplicationState {
  const organization = createOrganization({ id: applicationOrganizationId(), type: 'clinic', displayName: 'Clínica Thats Life', timezone: 'America/Sao_Paulo', createdAt });
  const professional = createProfessionalProfile({ id: 'professional-1', organizationId: organization.id, userId: 'user-demo', displayName: 'Dra. Camila', councilType: 'CRP', councilRegistration: '06/148293', specialties: ['TCC'], createdAt });
  const adminUser = createIdentityUser({ id: 'admin-demo', displayName: 'Coordenação Viver Mais', normalizedEmail: 'admin@vivermais.local', createdAt });
  const adminMembership = { ...createOrganizationMembership({ id: 'membership-admin-demo', organizationId: organization.id, userId: adminUser.id, roles: ['owner', 'admin'], createdAt }), status: 'active' as const };
  const membership: OrganizationMembership = { id: 'membership-demo', organizationId: organization.id, userId: professional.userId, roles: ['professional', 'billing'], status: 'active', professionalProfileId: professional.id, createdAt, updatedAt: createdAt };

  return {
    identities: new InMemoryIdentityRepository({ organizations: [organization], users: [adminUser], memberships: [membership, adminMembership], professionals: [professional], patients: [] }),
    appointments: new InMemoryAppointmentRepository([]), notifications: new InMemoryNotificationRepository(), communicationAudit: new InMemoryCommunicationAudit(),
    sessions: new InMemoryClinicalSessionRepository([]), records: new InMemoryClinicalRecordRepository([]),
    timeline: new InMemoryClinicalTimelineRepository([]),
    timelineAudit: new InMemoryClinicalTimelineAccessAudit(),
    preferences: [],
    consents: [],
    financial: new InMemoryFinancialRepository({ charges: [] }),
    deliveredHandoffs: [], assessments: [],
  };
}

function stateFromSnapshot(snapshot: PersistedSnapshot): DemoApplicationState {
  const seed = createState();
  return {
    ...seed,
    appointments: new InMemoryAppointmentRepository(snapshot.appointments),
    sessions: new InMemoryClinicalSessionRepository(snapshot.sessions),
    records: new InMemoryClinicalRecordRepository(snapshot.records),
    timeline: new InMemoryClinicalTimelineRepository(snapshot.timeline),
    notifications: new InMemoryNotificationRepository(snapshot.notifications),
    financial: new InMemoryFinancialRepository(snapshot.ledger),
    preferences: [...snapshot.preferences],
    consents: [...snapshot.consents],
    deliveredHandoffs: [...snapshot.deliveredHandoffs],
    assessments: [...snapshot.assessments],
  };
}

/**
 * Coleções que ainda não têm adaptador MySQL e continuam vivendo no arquivo.
 *
 * Enquanto esta lista não for vazia, o snapshot continua fazendo parte do
 * sistema — declarar o resíduo é preferível a deixá-lo implícito num arquivo
 * que ninguém sabe mais se importa.
 */
function residuo(state: DemoApplicationState) {
  return {
    deliveredHandoffs: state.deliveredHandoffs,
    assessments: state.assessments,
    preferences: state.preferences,
    consents: state.consents,
  };
}

/** Lê o estado corrente pelas APIs públicas dos repositórios. */
export async function captureSnapshot(): Promise<PersistedSnapshot> {
  const state = getApplicationStore();
  const organizationId = applicationOrganizationId();

  const [appointments, sessions, records, notifications, ledger] = await Promise.all([
    state.appointments.list({ organizationId }),
    state.sessions.list({ organizationId }),
    state.records.list({ organizationId }),
    state.notifications.list({ organizationId }),
    state.financial.getLedger({ organizationId }),
  ]);

  const patientIds = new Set([
    ...appointments.map((item) => item.patientId),
    ...sessions.map((item) => item.patientId),
    ...records.map((item) => item.patientId),
  ]);
  const timelinePerPatient = await Promise.all(
    [...patientIds].map((patientId) => state.timeline.list({ organizationId, patientId }))
  );

  return {
    version: 1,
    savedAt: new Date().toISOString(),
    appointments,
    sessions,
    records,
    timeline: timelinePerPatient.flat(),
    notifications,
    ledger,
    ...residuo(state),
  };
}

/**
 * Grava o estado corrente. Falhas de escrita são registradas mas nunca derrubam
 * a requisição — o estado em memória segue válido e a próxima gravação tenta de
 * novo.
 *
 * **Com MySQL configurado, só o resíduo é gravado.** Prontuário, sessão, linha
 * do tempo, agenda, identidade e financeiro já foram commitados no banco pelo
 * repositório que os atendeu; reescrevê-los aqui seria escrita dupla — a fonte
 * de verdade passaria a ser duas, e a que diverge sempre é a que ninguém olha.
 * É também o que fazia cada mutação reserializar o histórico clínico inteiro.
 *
 * Sem MySQL, o comportamento é o de antes: o arquivo guarda tudo, e é o que
 * mantém a instalação de demonstração viva entre reinícios.
 */
export async function persistApplicationState(): Promise<void> {
  if (isMysqlConfigured()) {
    const atual = readSnapshot();
    await writeSnapshot({
      ...(atual ?? (await captureSnapshot())),
      savedAt: new Date().toISOString(),
      ...residuo(getApplicationStore()),
    });
    return;
  }

  await writeSnapshot(await captureSnapshot());
}

/**
 * Estado com MySQL da OCI como fonte de verdade.
 *
 * Prontuário, linha do tempo, sessão clínica, financeiro, identidade e agenda
 * vêm do banco. O que sobra no snapshot é resíduo — preferências,
 * consentimentos, avaliações e entregas ao paciente —, declarado aqui em vez de
 * escondido: enquanto essa lista não for vazia, o arquivo continua fazendo
 * parte do sistema.
 *
 * A trilha de acesso é a mesma instância para prontuário e linha do tempo, e é
 * de propósito: as duas respondem "quem leu o histórico deste paciente", e
 * separá-las em duas tabelas obrigaria a juntar as duas na hora de responder.
 */
function createMysqlBackedState(): DemoApplicationState {
  const snapshot = readSnapshot();
  const state = snapshot ? stateFromSnapshot(snapshot) : createState();
  const acessos = new MysqlClinicalAccessAudit();

  return {
    ...state,
    identities: new MysqlIdentityRepository(),
    appointments: new MysqlAppointmentRepository(),
    sessions: new MysqlClinicalSessionRepository(),
    records: new MysqlClinicalRecordRepository(),
    timeline: new MysqlClinicalTimelineRepository(),
    timelineAudit: acessos,
    financial: new MysqlFinancialRepository(),
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
