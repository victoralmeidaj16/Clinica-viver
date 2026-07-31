import type {
  AiDraftProvenance,
  ClinicalRecord,
  ClinicalRecordEvent,
  ClinicalRecordStatus,
  SoapClinicalContent,
} from './types';

export interface ClinicalRecordFilter {
  organizationId: string;
  patientId?: string;
  professionalId?: string;
  statuses?: readonly ClinicalRecordStatus[];
  createdFrom?: string;
  createdUntil?: string;
}

export interface CommitClinicalRecordInput {
  record: ClinicalRecord;
  expectedVersion: number;
  commandId: string;
  events: readonly ClinicalRecordEvent[];
}

export interface ClinicalRecordRepository {
  getById(
    organizationId: string,
    recordId: string
  ): Promise<ClinicalRecord | null>;
  findBySessionId(
    organizationId: string,
    sessionId: string
  ): Promise<ClinicalRecord | null>;
  findByCommandId(
    organizationId: string,
    commandId: string
  ): Promise<ClinicalRecord | null>;
  list(filter: ClinicalRecordFilter): Promise<readonly ClinicalRecord[]>;
  commit(input: CommitClinicalRecordInput): Promise<void>;
}

export interface ClinicalRecordDraftProviderPort {
  generateSoapDraft(input: {
    organizationId: string;
    sessionId: string;
    patientReference: string;
    transcriptionId: string;
    previousApprovedRevision?: SoapClinicalContent;
  }): Promise<{
    content: SoapClinicalContent;
    provenance: AiDraftProvenance;
  }>;
}

export interface ClinicalRecordContentProtectionPort {
  seal(input: {
    organizationId: string;
    recordId: string;
    plaintext: string;
  }): Promise<{
    ciphertext: string;
    keyReference: string;
    algorithm: string;
  }>;
  open(input: {
    organizationId: string;
    recordId: string;
    ciphertext: string;
    keyReference: string;
    algorithm: string;
  }): Promise<string>;
}

export interface ClinicalRecordAccessAuditEvent {
  id: string;
  organizationId: string;
  actorUserId: string;
  action:
    | 'clinical_record.read'
    | 'clinical_record.listed'
    | 'clinical_record.access_denied';
  recordId?: string;
  occurredAt: string;
  correlationId: string;
  reason?: string;
  resultCount?: number;
}

export interface ClinicalRecordAccessAuditPort {
  append(event: ClinicalRecordAccessAuditEvent): Promise<void>;
}
