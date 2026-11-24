import {
  authorizeStaff,
  type IdentityRepository,
  type StaffAccessContext,
} from '../identity';
import type {
  ClinicalTimelineAccessAuditPort,
  ClinicalTimelineRepository,
} from './ports';
import { searchClinicalTimeline } from './search';
import type {
  ClinicalTimelineCategory,
  ClinicalTimelineEntry,
  ClinicalTimelineSearchResult,
} from './types';

export interface ClinicalTimelineQueryDependencies {
  timelines: ClinicalTimelineRepository;
  identities: IdentityRepository;
  audit: ClinicalTimelineAccessAuditPort;
}

export interface ClinicalTimelineQueryMetadata {
  occurredAt: string;
  correlationId: string;
}

async function authorizedEntries(
  dependencies: ClinicalTimelineQueryDependencies,
  actor: StaffAccessContext,
  input: {
    patientId: string;
    categories?: readonly ClinicalTimelineCategory[];
    occurredFrom?: string;
    occurredUntil?: string;
  }
): Promise<readonly ClinicalTimelineEntry[]> {
  const patient = await dependencies.identities.getPatient(
    actor.organizationId,
    input.patientId
  );
  if (!patient) throw new Error('Paciente não encontrado na organização.');
  const vinculoAtual = authorizeStaff(actor, 'clinical_records.read', {
    organizationId: patient.organizationId,
    patientId: patient.id,
    assignedProfessionalIds: patient.assignedProfessionalIds,
  });
  // Sem permissão clínica (a Gestão), de outra organização ou com vínculo
  // inativo, não há o que consultar. Só o psicólogo que deixou de ser o
  // responsável segue adiante: ele pode ser autor de registros anteriores.
  if (!vinculoAtual.allowed && vinculoAtual.reason !== 'professional_not_assigned') {
    throw new Error(`Acesso negado: ${vinculoAtual.reason}.`);
  }
  const entries = await dependencies.timelines.list({
    organizationId: actor.organizationId,
    patientId: patient.id,
    categories: input.categories,
    occurredFrom: input.occurredFrom,
    occurredUntil: input.occurredUntil,
  });
  // Cada entrada guarda quem estava autorizado quando foi registrada. A
  // leitura segue essa autoria e o período do vínculo, e não o responsável
  // atual: o sucessor não vê o que veio antes dele, e o autor conserva acesso
  // ao que registrou mesmo depois da transferência ou da inativação
  // (especificação final, §§ 6.09, 8.05 e 13.03).
  const visiveis = entries.filter((entry) => authorizeStaff(actor, 'clinical_records.read', {
    organizationId: entry.organizationId,
    patientId: entry.patientId,
    assignedProfessionalIds: entry.authorizedProfessionalIds,
  }).allowed);
  if (!vinculoAtual.allowed && visiveis.length === 0) {
    throw new Error(`Acesso negado: ${vinculoAtual.reason}.`);
  }
  return visiveis;
}

export async function listClinicalTimelineForStaff(
  dependencies: ClinicalTimelineQueryDependencies,
  actor: StaffAccessContext,
  input: {
    patientId: string;
    categories?: readonly ClinicalTimelineCategory[];
    occurredFrom?: string;
    occurredUntil?: string;
  },
  metadata: ClinicalTimelineQueryMetadata
): Promise<readonly ClinicalTimelineEntry[]> {
  const entries = await authorizedEntries(dependencies, actor, input);
  await dependencies.audit.append({
    id: `${metadata.correlationId}:clinical_timeline.listed`,
    organizationId: actor.organizationId,
    patientId: input.patientId,
    actorUserId: actor.userId,
    action: 'clinical_timeline.listed',
    occurredAt: metadata.occurredAt,
    correlationId: metadata.correlationId,
    resultCount: entries.length,
  });
  return entries;
}

export async function searchClinicalTimelineForStaff(
  dependencies: ClinicalTimelineQueryDependencies,
  actor: StaffAccessContext,
  input: {
    patientId: string;
    query: string;
    categories?: readonly ClinicalTimelineCategory[];
  },
  metadata: ClinicalTimelineQueryMetadata
): Promise<ClinicalTimelineSearchResult> {
  const entries = await authorizedEntries(dependencies, actor, input);
  const result = searchClinicalTimeline(entries, input.query);
  await dependencies.audit.append({
    id: `${metadata.correlationId}:clinical_timeline.searched`,
    organizationId: actor.organizationId,
    patientId: input.patientId,
    actorUserId: actor.userId,
    action: 'clinical_timeline.searched',
    occurredAt: metadata.occurredAt,
    correlationId: metadata.correlationId,
    resultCount: result.matches.length,
  });
  return result;
}
