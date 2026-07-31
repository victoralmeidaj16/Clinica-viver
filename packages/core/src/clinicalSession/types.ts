export type ClinicalSessionStatus =
  | 'scheduled'
  | 'confirmed'
  | 'in_progress'
  | 'awaiting_processing'
  | 'processing_failed'
  | 'awaiting_review'
  | 'ready_to_complete'
  | 'completed'
  | 'cancelled'
  | 'no_show';

export type SessionMode = 'in_person' | 'video' | 'phone';

export type SessionConsentType =
  | 'recording'
  | 'ai_processing'
  | 'patient_handoff'
  | 'transactional_communication';

export interface SessionConsentRecord {
  id: string;
  type: SessionConsentType;
  status: 'granted' | 'declined' | 'revoked';
  grantedBy:
    | { actorType: 'patient'; patientId: string }
    | { actorType: 'responsible'; responsiblePartyId: string };
  policyVersion: string;
  capturedAt: string;
  evidenceReference?: string;
}

export type AutomationStepName =
  | 'transcription'
  | 'clinical_draft'
  | 'patient_handoff'
  | 'billing'
  | 'receipt'
  | 'notification';

export type AutomationStepStatus =
  | 'skipped'
  | 'idle'
  | 'queued'
  | 'processing'
  | 'requires_review'
  | 'approved'
  | 'completed'
  | 'failed';

export interface AutomationStepState {
  status: AutomationStepStatus;
  attemptCount: number;
  updatedAt: string;
  errorCode?: string;
}

export interface SessionAutomationPlan {
  transcription: boolean;
  patientHandoff: boolean;
  billing: boolean;
  receipt: boolean;
  notification: boolean;
}

export interface SessionAutomationState {
  transcription: AutomationStepState;
  clinicalDraft: AutomationStepState;
  patientHandoff: AutomationStepState;
  billing: AutomationStepState;
  receipt: AutomationStepState;
  notification: AutomationStepState;
}

export interface RecordingReference {
  id: string;
  storageKey: string;
  checksumSha256?: string;
  capturedAt: string;
  retentionUntil: string;
}

export interface TranscriptionReference {
  id: string;
  recordingId: string;
  producedAt: string;
  providerReference?: string;
}

export interface ClinicalSessionArtifacts {
  recording?: RecordingReference;
  transcription?: TranscriptionReference;
  clinicalDraftId?: string;
  approvedClinicalRecordId?: string;
  patientHandoffSessionId?: string;
  chargeId?: string;
  receiptId?: string;
}

export interface ClinicalSession {
  schemaVersion: 1;
  id: string;
  organizationId: string;
  patientId: string;
  primaryProfessionalId: string;
  assignedProfessionalIds: readonly string[];
  status: ClinicalSessionStatus;
  mode: SessionMode;
  scheduledStart: string;
  scheduledEnd: string;
  actualStart?: string;
  actualEnd?: string;
  cancellationReasonCode?: string;
  consentRecords: readonly SessionConsentRecord[];
  automationPlan: SessionAutomationPlan;
  automation: SessionAutomationState;
  artifacts: ClinicalSessionArtifacts;
  version: number;
  createdAt: string;
  updatedAt: string;
}

export type ClinicalSessionEventType =
  | 'clinical_session.scheduled'
  | 'clinical_session.confirmed'
  | 'clinical_session.started'
  | 'clinical_session.consent_recorded'
  | 'clinical_session.recording_attached'
  | 'clinical_session.ended'
  | 'clinical_session.transcription_completed'
  | 'clinical_session.draft_ready'
  | 'clinical_session.record_approved'
  | 'clinical_session.handoff_delivered'
  | 'clinical_session.billing_created'
  | 'clinical_session.receipt_issued'
  | 'clinical_session.notification_sent'
  | 'clinical_session.completed'
  | 'clinical_session.cancelled'
  | 'clinical_session.no_show'
  | 'clinical_session.automation_failed'
  | 'clinical_session.automation_retried';

export interface ClinicalSessionEvent {
  id: string;
  type: ClinicalSessionEventType;
  organizationId: string;
  sessionId: string;
  patientId: string;
  actorUserId: string;
  occurredAt: string;
  correlationId: string;
  metadata?: Readonly<Record<string, string | number | boolean>>;
}

export interface SessionTransitionResult {
  session: ClinicalSession;
  events: readonly ClinicalSessionEvent[];
}
