import type {
  PreSessionAssessmentSnapshot,
  PreSessionCheckIn,
  PreSessionCheckInEvent,
  PreSessionCheckInEventType,
  PreSessionCheckInResponse,
  PreSessionCommandMetadata,
  PreSessionReviewReason,
  PreSessionTransitionResult,
} from './types';
import {
  assertMoodLevel,
  assertWithinWindow,
  isoDate,
  optionalTopics,
  requiredText,
} from './validation';

export interface SchedulePreSessionCheckInInput {
  id: string;
  organizationId: string;
  appointmentId: string;
  patientId: string;
  professionalId: string;
  availableFrom: string;
  expiresAt: string;
  createdAt: string;
}

function event(
  checkIn: PreSessionCheckIn,
  type: PreSessionCheckInEventType,
  metadata: PreSessionCommandMetadata,
  details?: Readonly<Record<string, string | number | boolean>>
): PreSessionCheckInEvent {
  return {
    id: `${metadata.correlationId}:${type}`,
    type,
    organizationId: checkIn.organizationId,
    checkInId: checkIn.id,
    appointmentId: checkIn.appointmentId,
    patientId: checkIn.patientId,
    professionalId: checkIn.professionalId,
    actorUserId: requiredText(metadata.actorUserId, 'actorUserId'),
    occurredAt: isoDate(metadata.occurredAt, 'occurredAt'),
    correlationId: requiredText(metadata.correlationId, 'correlationId'),
    metadata: details,
  };
}

function next(
  checkIn: PreSessionCheckIn,
  status: PreSessionCheckIn['status'],
  occurredAt: string
): PreSessionCheckIn {
  return {
    ...checkIn,
    status,
    version: checkIn.version + 1,
    updatedAt: isoDate(occurredAt, 'occurredAt'),
  };
}

function assessmentSnapshot(
  value?: PreSessionAssessmentSnapshot
): PreSessionAssessmentSnapshot | undefined {
  if (!value) return undefined;
  if (!Number.isInteger(value.totalScore) || value.totalScore < 0) {
    throw new Error('assessment.totalScore deve ser um inteiro não negativo.');
  }
  return {
    responseId: requiredText(value.responseId, 'assessment.responseId'),
    instrumentCode: value.instrumentCode,
    totalScore: value.totalScore,
    severityLabel: requiredText(value.severityLabel, 'assessment.severityLabel'),
    hasRiskAlert: value.hasRiskAlert,
    riskAlertReason: value.riskAlertReason
      ? requiredText(value.riskAlertReason, 'assessment.riskAlertReason')
      : undefined,
  };
}

function normalizedResponse(
  input: PreSessionCheckInResponse
): PreSessionCheckInResponse {
  assertMoodLevel(input.moodLevel);
  const assessment = assessmentSnapshot(input.assessment);
  if (input.moodLevel === undefined && !assessment) {
    throw new Error('Informe ao menos uma resposta estruturada no check-in.');
  }
  return {
    moodLevel: input.moodLevel,
    topicsToDiscuss: optionalTopics(input.topicsToDiscuss),
    assessment,
  };
}

function reviewReasons(
  response: PreSessionCheckInResponse
): readonly PreSessionReviewReason[] {
  const reasons: PreSessionReviewReason[] = [];
  if (response.moodLevel === 1) reasons.push('very_low_mood');
  if (response.assessment?.hasRiskAlert) reasons.push('assessment_risk');
  return reasons;
}

export function schedulePreSessionCheckIn(
  input: SchedulePreSessionCheckInInput,
  metadata: PreSessionCommandMetadata
): PreSessionTransitionResult {
  const createdAt = isoDate(input.createdAt, 'createdAt');
  const availableFrom = isoDate(input.availableFrom, 'availableFrom');
  const expiresAt = isoDate(input.expiresAt, 'expiresAt');
  if (Date.parse(expiresAt) <= Date.parse(availableFrom)) {
    throw new Error('expiresAt deve ser posterior a availableFrom.');
  }
  if (Date.parse(createdAt) >= Date.parse(expiresAt)) {
    throw new Error('Não é possível criar um check-in já expirado.');
  }

  const status =
    Date.parse(createdAt) >= Date.parse(availableFrom) ? 'available' : 'scheduled';
  const checkIn: PreSessionCheckIn = {
    schemaVersion: 1,
    id: requiredText(input.id, 'id'),
    organizationId: requiredText(input.organizationId, 'organizationId'),
    appointmentId: requiredText(input.appointmentId, 'appointmentId'),
    patientId: requiredText(input.patientId, 'patientId'),
    professionalId: requiredText(input.professionalId, 'professionalId'),
    availableFrom,
    expiresAt,
    status,
    reviewReasons: [],
    version: 1,
    createdAt,
    updatedAt: createdAt,
  };
  return {
    checkIn,
    events: [
      event(checkIn, 'pre_session_check_in.scheduled', metadata, {
        initiallyAvailable: status === 'available',
      }),
    ],
  };
}

export function makePreSessionCheckInAvailable(
  checkIn: PreSessionCheckIn,
  metadata: PreSessionCommandMetadata
): PreSessionTransitionResult {
  if (checkIn.status !== 'scheduled') {
    throw new Error('Somente um check-in agendado pode ser disponibilizado.');
  }
  assertWithinWindow(metadata.occurredAt, checkIn.availableFrom, checkIn.expiresAt);
  const updated = next(checkIn, 'available', metadata.occurredAt);
  return {
    checkIn: updated,
    events: [event(updated, 'pre_session_check_in.available', metadata)],
  };
}

export function startPreSessionCheckIn(
  checkIn: PreSessionCheckIn,
  metadata: PreSessionCommandMetadata
): PreSessionTransitionResult {
  if (checkIn.status !== 'available') {
    throw new Error('Somente um check-in disponível pode ser iniciado.');
  }
  assertWithinWindow(metadata.occurredAt, checkIn.availableFrom, checkIn.expiresAt);
  const updated = next(checkIn, 'in_progress', metadata.occurredAt);
  return {
    checkIn: updated,
    events: [event(updated, 'pre_session_check_in.started', metadata)],
  };
}

export function submitPreSessionCheckIn(
  checkIn: PreSessionCheckIn,
  responseInput: PreSessionCheckInResponse,
  metadata: PreSessionCommandMetadata
): PreSessionTransitionResult {
  if (!['available', 'in_progress'].includes(checkIn.status)) {
    throw new Error('O check-in não está disponível para envio.');
  }
  assertWithinWindow(metadata.occurredAt, checkIn.availableFrom, checkIn.expiresAt);
  const response = normalizedResponse(responseInput);
  const reasons = reviewReasons(response);
  const status = reasons.length > 0 ? 'review_required' : 'submitted';
  const updated: PreSessionCheckIn = {
    ...next(checkIn, status, metadata.occurredAt),
    response,
    reviewReasons: reasons,
    submittedAt: metadata.occurredAt,
  };
  const events: PreSessionCheckInEvent[] = [
    event(updated, 'pre_session_check_in.submitted', metadata, {
      hasTopicsToDiscuss: Boolean(response.topicsToDiscuss),
      hasAssessment: Boolean(response.assessment),
    }),
  ];
  if (status === 'review_required') {
    events.push(
      event(updated, 'pre_session_check_in.review_required', metadata, {
        reasonCount: reasons.length,
      })
    );
  }
  return { checkIn: updated, events };
}

export function reviewPreSessionCheckIn(
  checkIn: PreSessionCheckIn,
  metadata: PreSessionCommandMetadata
): PreSessionTransitionResult {
  if (!['submitted', 'review_required'].includes(checkIn.status)) {
    throw new Error('Somente um check-in enviado pode ser revisado.');
  }
  const updated: PreSessionCheckIn = {
    ...next(checkIn, 'reviewed', metadata.occurredAt),
    reviewedByUserId: requiredText(metadata.actorUserId, 'actorUserId'),
    reviewedAt: metadata.occurredAt,
  };
  return {
    checkIn: updated,
    events: [event(updated, 'pre_session_check_in.reviewed', metadata)],
  };
}

export function expirePreSessionCheckIn(
  checkIn: PreSessionCheckIn,
  metadata: PreSessionCommandMetadata
): PreSessionTransitionResult {
  if (!['scheduled', 'available', 'in_progress'].includes(checkIn.status)) {
    throw new Error('O check-in não pode mais expirar.');
  }
  if (Date.parse(isoDate(metadata.occurredAt, 'occurredAt')) < Date.parse(checkIn.expiresAt)) {
    throw new Error('O check-in ainda está dentro da janela de resposta.');
  }
  const updated = next(checkIn, 'expired', metadata.occurredAt);
  return {
    checkIn: updated,
    events: [event(updated, 'pre_session_check_in.expired', metadata)],
  };
}
