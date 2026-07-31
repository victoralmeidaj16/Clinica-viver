import type { SupportedAssessmentCode } from '../assessmentTypes';

export type PreSessionCheckInStatus =
  | 'scheduled'
  | 'available'
  | 'in_progress'
  | 'submitted'
  | 'review_required'
  | 'reviewed'
  | 'expired';

export type PreSessionReviewReason = 'assessment_risk' | 'very_low_mood';

export interface PreSessionAssessmentSnapshot {
  responseId: string;
  instrumentCode: SupportedAssessmentCode;
  totalScore: number;
  severityLabel: string;
  hasRiskAlert: boolean;
  riskAlertReason?: string;
}

export interface PreSessionCheckInResponse {
  moodLevel?: 1 | 2 | 3 | 4 | 5;
  topicsToDiscuss?: string;
  assessment?: PreSessionAssessmentSnapshot;
}

export interface PreSessionCheckIn {
  schemaVersion: 1;
  id: string;
  organizationId: string;
  appointmentId: string;
  patientId: string;
  professionalId: string;
  availableFrom: string;
  expiresAt: string;
  status: PreSessionCheckInStatus;
  response?: PreSessionCheckInResponse;
  reviewReasons: readonly PreSessionReviewReason[];
  submittedAt?: string;
  reviewedByUserId?: string;
  reviewedAt?: string;
  version: number;
  createdAt: string;
  updatedAt: string;
}

export type PreSessionCheckInEventType =
  | 'pre_session_check_in.scheduled'
  | 'pre_session_check_in.available'
  | 'pre_session_check_in.started'
  | 'pre_session_check_in.submitted'
  | 'pre_session_check_in.review_required'
  | 'pre_session_check_in.reviewed'
  | 'pre_session_check_in.expired';

export interface PreSessionCheckInEvent {
  id: string;
  type: PreSessionCheckInEventType;
  organizationId: string;
  checkInId: string;
  appointmentId: string;
  patientId: string;
  professionalId: string;
  actorUserId: string;
  occurredAt: string;
  correlationId: string;
  metadata?: Readonly<Record<string, string | number | boolean>>;
}

export interface PreSessionCommandMetadata {
  actorUserId: string;
  occurredAt: string;
  correlationId: string;
}

export interface PreSessionTransitionResult {
  checkIn: PreSessionCheckIn;
  events: readonly PreSessionCheckInEvent[];
}

export interface PreSessionBriefing {
  checkInId: string;
  appointmentId: string;
  patientId: string;
  professionalId: string;
  submittedAt: string;
  moodLevel?: 1 | 2 | 3 | 4 | 5;
  topicsToDiscuss?: string;
  assessment?: PreSessionAssessmentSnapshot;
  reviewRequired: boolean;
  reviewReasons: readonly PreSessionReviewReason[];
  reviewed: boolean;
}
