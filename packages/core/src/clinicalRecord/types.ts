export interface SoapClinicalContent {
  subjective: string;
  objective: string;
  assessment: string;
  plan: string;
  extractedTasks: readonly string[];
}

export interface AiDraftProvenance {
  provider: string;
  model: string;
  promptVersion: string;
  transcriptionId: string;
  generatedAt: string;
}

export interface ClinicalRecordRevision {
  id: string;
  revisionNumber: number;
  kind: 'initial' | 'amendment';
  source: 'manual' | 'ai_assisted';
  content: SoapClinicalContent;
  amendmentReason?: string;
  aiProvenance?: AiDraftProvenance;
  createdByUserId: string;
  createdAt: string;
}

export interface ClinicalRecordApproval {
  id: string;
  revisionNumber: number;
  professionalId: string;
  approvedByUserId: string;
  approvedAt: string;
  contentHashSha256: string;
  attestation: 'reviewed_and_approved_by_professional';
}

export type ClinicalRecordStatus =
  | 'draft'
  | 'approved'
  | 'amendment_draft';

export interface ClinicalRecord {
  schemaVersion: 1;
  id: string;
  organizationId: string;
  patientId: string;
  sessionId: string;
  responsibleProfessionalId: string;
  assignedProfessionalIds: readonly string[];
  status: ClinicalRecordStatus;
  revisions: readonly ClinicalRecordRevision[];
  approvals: readonly ClinicalRecordApproval[];
  activeDraftRevisionNumber?: number;
  currentApprovedRevisionNumber?: number;
  retentionUntil: string;
  legalHold: boolean;
  version: number;
  createdAt: string;
  updatedAt: string;
}

export type ClinicalRecordEventType =
  | 'clinical_record.draft_created'
  | 'clinical_record.approved'
  | 'clinical_record.amendment_created'
  | 'clinical_record.amendment_approved'
  | 'clinical_record.legal_hold_changed';

export interface ClinicalRecordEvent {
  id: string;
  type: ClinicalRecordEventType;
  organizationId: string;
  recordId: string;
  patientId: string;
  sessionId: string;
  actorUserId: string;
  occurredAt: string;
  correlationId: string;
  metadata?: Readonly<Record<string, string | number | boolean>>;
}

export interface ClinicalRecordTransitionResult {
  record: ClinicalRecord;
  events: readonly ClinicalRecordEvent[];
}
