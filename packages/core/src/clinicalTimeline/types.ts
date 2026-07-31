export type ClinicalTimelineCategory =
  | 'clinical_record'
  | 'session'
  | 'assessment'
  | 'mood'
  | 'habit'
  | 'task'
  | 'goal'
  | 'pre_session'
  | 'appointment'
  | 'alert';

export type ClinicalTimelineImportance =
  | 'routine'
  | 'attention'
  | 'milestone';

export type ClinicalTimelineSourceType =
  | 'clinical_record_revision'
  | 'clinical_session_event'
  | 'assessment_response'
  | 'mood_check_in'
  | 'habit_observation'
  | 'care_plan'
  | 'pre_session_check_in'
  | 'appointment_event'
  | 'care_alert';

export interface TimelineEvidenceReference {
  sourceType: ClinicalTimelineSourceType;
  sourceId: string;
  sourceVersion?: number;
  sourceRevisionId?: string;
  sourceField?: string;
  contentHashSha256?: string;
}

export interface ClinicalTimelineEntry {
  schemaVersion: 1;
  id: string;
  organizationId: string;
  patientId: string;
  authorizedProfessionalIds: readonly string[];
  category: ClinicalTimelineCategory;
  importance: ClinicalTimelineImportance;
  occurredAt: string;
  recordedAt: string;
  title: string;
  summary: string;
  evidenceExcerpt?: string;
  tags: readonly string[];
  evidence: TimelineEvidenceReference;
}

export interface ClinicalTimelineFilter {
  organizationId: string;
  patientId: string;
  categories?: readonly ClinicalTimelineCategory[];
  occurredFrom?: string;
  occurredUntil?: string;
}

export interface ClinicalTimelineSearchMatch {
  entry: ClinicalTimelineEntry;
  matchedTerms: readonly string[];
  score: number;
}

export interface ClinicalTimelineSearchResult {
  mode: 'evidence_only';
  query: string;
  normalizedTerms: readonly string[];
  matches: readonly ClinicalTimelineSearchMatch[];
  firstEvidenceAt?: string;
}

export interface HabitObservationInput {
  id: string;
  organizationId: string;
  patientId: string;
  professionalIds: readonly string[];
  habitLabel: string;
  status: 'completed' | 'partial' | 'not_completed';
  occurredAt: string;
  recordedAt: string;
  sourceVersion?: number;
}
