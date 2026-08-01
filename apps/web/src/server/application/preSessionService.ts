import {
  assertStaffAuthorized,
  buildPreSessionBriefing,
  type PreSessionBriefing,
} from '@thats-life/core';
import type { RequestContext } from './context';
import { ApplicationError } from './http';
import { getApplicationStore } from './store';

export interface PreSessionBriefingResult {
  briefing: PreSessionBriefing | null;
  patientName?: string;
  hasRiskAlert: boolean;
}

export async function getPreSessionBriefing(
  context: RequestContext,
  appointmentId: string
): Promise<PreSessionBriefingResult> {
  const store = getApplicationStore();
  const appointment = await store.appointments.getById(
    context.actor.organizationId,
    appointmentId
  );

  if (!appointment) {
    throw new ApplicationError('NOT_FOUND', 'Agendamento não encontrado.', 404);
  }

  assertStaffAuthorized(context.actor, 'assessments.read', {
    organizationId: appointment.organizationId,
    patientId: appointment.patientId,
    assignedProfessionalIds: [appointment.professionalId],
  });

  const patient = await store.identities.getPatient(
    appointment.organizationId,
    appointment.patientId
  );

  const checkIns = await store.checkIns.list({
    organizationId: context.actor.organizationId,
    appointmentId,
  });

  const checkIn = checkIns[0] ?? null;

  if (!checkIn || !['submitted', 'review_required', 'reviewed'].includes(checkIn.status)) {
    return {
      briefing: null,
      patientName: patient?.displayName,
      hasRiskAlert: false,
    };
  }

  const briefing = buildPreSessionBriefing(checkIn);
  return {
    briefing,
    patientName: patient?.displayName,
    hasRiskAlert: briefing.reviewRequired || Boolean(briefing.assessment?.hasRiskAlert),
  };
}

export async function listRiskAlertCheckIns(context: RequestContext) {
  const store = getApplicationStore();
  assertStaffAuthorized(context.actor, 'assessments.read', {
    organizationId: context.actor.organizationId,
  });

  const checkIns = await store.checkIns.list({
    organizationId: context.actor.organizationId,
    statuses: ['review_required'],
  });

  return Promise.all(
    checkIns.map(async (c) => {
      const patient = await store.identities.getPatient(c.organizationId, c.patientId);
      return {
        checkInId: c.id,
        appointmentId: c.appointmentId,
        patientId: c.patientId,
        patientName: patient?.displayName ?? c.patientId,
        reviewReasons: c.reviewReasons,
        submittedAt: c.submittedAt,
        moodLevel: c.response?.moodLevel,
        topicsToDiscuss: c.response?.topicsToDiscuss,
      };
    })
  );
}
