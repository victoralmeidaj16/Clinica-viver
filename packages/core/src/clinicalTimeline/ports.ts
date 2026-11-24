import type {
  ClinicalTimelineCategory,
  ClinicalTimelineEntry,
  ClinicalTimelineFilter,
} from './types';

export interface ClinicalTimelineRepository {
  upsert(entries: readonly ClinicalTimelineEntry[]): Promise<void>;
  list(filter: ClinicalTimelineFilter): Promise<readonly ClinicalTimelineEntry[]>;
  /** Pacientes com entradas autorizadas a este profissional, de vínculos atuais ou encerrados. */
  listPatientIdsAuthorizedFor(filter: {
    organizationId: string;
    professionalId: string;
    categories?: readonly ClinicalTimelineCategory[];
  }): Promise<readonly string[]>;
}

export interface ClinicalTimelineAccessAuditPort {
  append(input: {
    id: string;
    organizationId: string;
    patientId: string;
    actorUserId: string;
    action: 'clinical_timeline.listed' | 'clinical_timeline.searched';
    occurredAt: string;
    correlationId: string;
    resultCount: number;
  }): Promise<void>;
}
