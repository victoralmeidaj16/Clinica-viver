import {
  completeCareTaskAsPatient,
  recordMoodAsPatient,
  submitPreSessionCheckInCommand,
  type CarePlan,
  type MoodCheckIn,
  type PreSessionAssessmentSnapshot,
} from '@thats-life/core';
import type { PatientRequestContext } from './patientContext';
import { ApplicationError } from './http';
import { getApplicationStore, persistApplicationState } from './store';

export async function getPatientPortal(context: PatientRequestContext) {
  const store = getApplicationStore();
  const { organizationId, patientId } = context.actor;

  const patient = await store.identities.getPatient(organizationId, patientId);
  if (!patient) {
    throw new ApplicationError('NOT_FOUND', 'Paciente não encontrado.', 404);
  }

  const allAppointments = await store.appointments.list({ organizationId, patientId });
  const nowIso = new Date().toISOString();
  const upcomingAppointments = allAppointments
    .filter((app) => app.status !== 'cancelled' && app.startsAt >= nowIso)
    .sort((a, b) => a.startsAt.localeCompare(b.startsAt));

  const nextAppointment = upcomingAppointments[0] ?? allAppointments[0] ?? null;

  const handoff = store.deliveredHandoffs
    .filter((h) => h.patientId === patientId)
    .sort((a, b) => (b.deliveredAt ?? '').localeCompare(a.deliveredAt ?? ''))[0] ?? null;

  const plan = store.carePlans.find(
    (p) => p.organizationId === organizationId && p.patientId === patientId
  );

  const tasks = plan
    ? plan.tasks.map((t) => ({ id: t.id, title: t.title, completed: t.status === 'completed' }))
    : handoff?.tasks ?? [];

  const moodLogs = store.moodLogs
    .filter((m) => m.organizationId === organizationId && m.patientId === patientId)
    .sort((a, b) => b.recordedAt.localeCompare(a.recordedAt));

  const pendingAssessment = {
    id: `assessment-pre-session-${patientId}`,
    type: 'PHQ-9 / GAD-7',
    title: 'Avaliação Pré-Sessão',
    description: 'Responda algumas perguntas rápidas sobre seu bem-estar nos últimos dias.',
    status: store.assessments.some((a) => a.patientId === patientId) ? 'completed' : 'pending',
  };

  return {
    patient: {
      id: patient.id,
      displayName: patient.displayName,
    },
    nextAppointment: nextAppointment
      ? {
          id: nextAppointment.id,
          startsAt: nextAppointment.startsAt,
          endsAt: nextAppointment.endsAt,
          mode: nextAppointment.mode,
          status: nextAppointment.status,
        }
      : null,
    handoff,
    tasks,
    moodLogs,
    pendingAssessment,
  };
}

export async function togglePatientTask(
  context: PatientRequestContext,
  taskId: string,
  occurredAt = new Date().toISOString()
) {
  const store = getApplicationStore();
  const { organizationId, patientId } = context.actor;

  const planIndex = store.carePlans.findIndex(
    (p) => p.organizationId === organizationId && p.patientId === patientId
  );

  if (planIndex < 0) {
    throw new ApplicationError('NOT_FOUND', 'Plano de cuidado do paciente não encontrado.', 404);
  }

  const currentPlan = store.carePlans[planIndex];
  const targetTask = currentPlan.tasks.find((t) => t.id === taskId);

  if (!targetTask) {
    throw new ApplicationError('NOT_FOUND', 'Tarefa não encontrada no plano de cuidado.', 404);
  }

  let updatedPlan: CarePlan;
  if (targetTask.status === 'pending') {
    updatedPlan = completeCareTaskAsPatient(currentPlan, context.actor, taskId, occurredAt);
  } else {
    // Alternar de completed para pending
    const tasks = currentPlan.tasks.map((t) =>
      t.id === taskId ? { ...t, status: 'pending' as const, completedAt: undefined } : t
    );
    updatedPlan = { ...currentPlan, tasks, version: currentPlan.version + 1, updatedAt: occurredAt };
  }

  store.carePlans[planIndex] = updatedPlan;

  // Atualizar também na lista de handoffs entregues se presente
  store.deliveredHandoffs.forEach((h) => {
    if (h.patientId === patientId) {
      h.tasks = h.tasks.map((t) =>
        t.id === taskId ? { ...t, completed: targetTask.status === 'pending' } : t
      );
    }
  });

  const updatedTask = updatedPlan.tasks.find((t) => t.id === taskId);
  await persistApplicationState();
  return {
    id: taskId,
    completed: updatedTask?.status === 'completed',
    tasks: updatedPlan.tasks.map((t) => ({ id: t.id, title: t.title, completed: t.status === 'completed' })),
  };
}

export async function recordPatientMood(
  context: PatientRequestContext,
  input: { level: 1 | 2 | 3 | 4 | 5; emotions: string[]; note?: string; occurredAt?: string }
) {
  const store = getApplicationStore();
  const { organizationId, patientId } = context.actor;
  const recordedAt = input.occurredAt ?? new Date().toISOString();

  const moodCheckIn: MoodCheckIn = {
    id: `mood-${Date.now()}`,
    organizationId,
    patientId,
    recordedAt,
    level: input.level,
    emotions: input.emotions,
    note: input.note,
  };

  const { checkIn, alert } = recordMoodAsPatient(context.actor, moodCheckIn);
  store.moodLogs.push(checkIn);

  await persistApplicationState();
  return { checkIn, alertCreated: Boolean(alert) };
}

export async function submitPatientAssessment(
  context: PatientRequestContext,
  input: { type: string; answers: Record<string, number>; occurredAt?: string }
) {
  const store = getApplicationStore();
  const { organizationId, patientId } = context.actor;
  const completedAt = input.occurredAt ?? new Date().toISOString();

  const score = Object.values(input.answers).reduce((sum, v) => sum + (Number(v) || 0), 0);

  const entry = {
    id: `assessment-${Date.now()}`,
    organizationId,
    patientId,
    type: input.type,
    answers: input.answers,
    score,
    completedAt,
  };

  store.assessments.push(entry);
  await persistApplicationState();
  return { id: entry.id, score, status: 'completed' };
}

export async function submitPatientPreSessionCheckIn(
  context: PatientRequestContext,
  input: {
    appointmentId?: string;
    topicsToDiscuss?: string;
    moodLevel?: 1 | 2 | 3 | 4 | 5;
    assessment?: PreSessionAssessmentSnapshot;
  },
  commandKey?: string
) {
  const store = getApplicationStore();
  const { organizationId, patientId } = context.actor;

  const checkInList = await store.checkIns.list({ organizationId, patientId });
  let checkIn = input.appointmentId
    ? checkInList.find((c) => c.appointmentId === input.appointmentId)
    : checkInList.find((c) => ['available', 'in_progress', 'scheduled'].includes(c.status));

  if (!checkIn) {
    const appointmentId = input.appointmentId ?? 'appointment-1';
    const nowIso = new Date().toISOString();
    checkIn = {
      schemaVersion: 1,
      id: `checkin-${appointmentId}`,
      organizationId,
      appointmentId,
      patientId,
      professionalId: 'professional-1',
      availableFrom: nowIso,
      expiresAt: new Date(Date.now() + 86400000).toISOString(),
      status: 'available',
      reviewReasons: [],
      version: 1,
      createdAt: nowIso,
      updatedAt: nowIso,
    };
    await store.checkIns.commit({
      checkIn,
      expectedVersion: 0,
      commandId: `init-${checkIn.id}`,
      events: [],
    });
  }

  const key = commandKey ?? context.idempotencyKey ?? `cmd-${Date.now()}`;
  const metadata = {
    actorUserId: context.actor.userId,
    occurredAt: new Date().toISOString(),
    correlationId: context.correlationId,
    commandId: key,
  };

  const result = await submitPreSessionCheckInCommand(
    { checkIns: store.checkIns },
    context.actor,
    checkIn.id,
    {
      topicsToDiscuss: input.topicsToDiscuss,
      moodLevel: input.moodLevel,
      assessment: input.assessment,
    },
    metadata
  );

  await persistApplicationState();
  return {
    checkInId: result.checkIn.id,
    status: result.checkIn.status,
    reviewRequired: result.checkIn.status === 'review_required',
    reviewReasons: result.checkIn.reviewReasons,
  };
}
