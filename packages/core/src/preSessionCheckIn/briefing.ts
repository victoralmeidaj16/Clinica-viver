import type { PreSessionBriefing, PreSessionCheckIn } from './types';

export function buildPreSessionBriefing(
  checkIn: PreSessionCheckIn
): PreSessionBriefing {
  if (
    !['submitted', 'review_required', 'reviewed'].includes(checkIn.status) ||
    !checkIn.response ||
    !checkIn.submittedAt
  ) {
    throw new Error('O briefing exige um check-in enviado.');
  }

  return {
    checkInId: checkIn.id,
    appointmentId: checkIn.appointmentId,
    patientId: checkIn.patientId,
    professionalId: checkIn.professionalId,
    submittedAt: checkIn.submittedAt,
    moodLevel: checkIn.response.moodLevel,
    topicsToDiscuss: checkIn.response.topicsToDiscuss,
    assessment: checkIn.response.assessment,
    reviewRequired: checkIn.status === 'review_required',
    reviewReasons: [...checkIn.reviewReasons],
    reviewed: checkIn.status === 'reviewed',
  };
}
