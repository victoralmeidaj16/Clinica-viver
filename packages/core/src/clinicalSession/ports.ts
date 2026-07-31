import type { PatientHandoff } from '../patientHandoff';
import type {
  ClinicalSession,
  ClinicalSessionEvent,
  ClinicalSessionStatus,
  RecordingReference,
  TranscriptionReference,
} from './types';

export interface ClinicalSessionFilter {
  organizationId: string;
  patientId?: string;
  professionalId?: string;
  statuses?: readonly ClinicalSessionStatus[];
  scheduledFrom?: string;
  scheduledUntil?: string;
}

export interface CommitClinicalSessionInput {
  session: ClinicalSession;
  expectedVersion: number;
  commandId: string;
  events: readonly ClinicalSessionEvent[];
}

export interface ClinicalSessionRepository {
  getById(
    organizationId: string,
    sessionId: string
  ): Promise<ClinicalSession | null>;
  list(filter: ClinicalSessionFilter): Promise<readonly ClinicalSession[]>;
  findByCommandId(
    organizationId: string,
    commandId: string
  ): Promise<ClinicalSession | null>;
  commit(input: CommitClinicalSessionInput): Promise<void>;
}

export type SessionAutomationJob =
  | {
      type: 'transcribe_recording';
      organizationId: string;
      sessionId: string;
      recording: RecordingReference;
    }
  | {
      type: 'generate_clinical_draft';
      organizationId: string;
      sessionId: string;
      transcription: TranscriptionReference;
    }
  | {
      type: 'deliver_patient_handoff';
      organizationId: string;
      sessionId: string;
      handoff: PatientHandoff;
    }
  | {
      type: 'create_session_billing';
      organizationId: string;
      sessionId: string;
    };

export interface SessionJobQueuePort {
  enqueue(job: SessionAutomationJob, idempotencyKey: string): Promise<void>;
}

export interface RecordingStoragePort {
  createUploadTarget(input: {
    organizationId: string;
    sessionId: string;
    contentType: string;
    retentionUntil: string;
  }): Promise<{ uploadReference: string; storageKey: string }>;
  confirmUpload(input: {
    uploadReference: string;
    checksumSha256: string;
  }): Promise<RecordingReference>;
  deleteRecording(storageKey: string, reason: string): Promise<void>;
}

export interface TranscriptionProviderPort {
  transcribe(input: {
    organizationId: string;
    sessionId: string;
    recording: RecordingReference;
    language: 'pt-BR';
  }): Promise<TranscriptionReference>;
}

export interface ClinicalDraftProviderPort {
  generateDraft(input: {
    organizationId: string;
    sessionId: string;
    patientReference: string;
    transcription: TranscriptionReference;
  }): Promise<{ clinicalDraftId: string }>;
}
