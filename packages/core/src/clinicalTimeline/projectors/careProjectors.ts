import type { CareAlert, CarePlan, MoodCheckIn } from '../../carePlan';
import { createClinicalTimelineEntry, timelineEntryId } from '../entryFactory';
import type {
  ClinicalTimelineEntry,
  HabitObservationInput,
} from '../types';

export function projectMoodCheckIn(
  checkIn: MoodCheckIn,
  professionalIds: readonly string[]
): ClinicalTimelineEntry {
  const emotions = checkIn.emotions.join(', ');
  return createClinicalTimelineEntry({
    id: timelineEntryId('mood_check_in', checkIn.id, 'mood'),
    organizationId: checkIn.organizationId,
    patientId: checkIn.patientId,
    authorizedProfessionalIds: professionalIds,
    category: 'mood',
    importance: checkIn.level === 1 ? 'attention' : 'routine',
    occurredAt: checkIn.recordedAt,
    recordedAt: checkIn.recordedAt,
    title: `Humor registrado: ${checkIn.level}/5`,
    summary: emotions ? `Emoções selecionadas: ${emotions}.` : 'Sem emoções selecionadas.',
    evidenceExcerpt: checkIn.note,
    tags: ['humor', ...checkIn.emotions],
    evidence: {
      sourceType: 'mood_check_in',
      sourceId: checkIn.id,
      sourceField: checkIn.note ? 'note' : 'level',
    },
  });
}

export function projectCarePlan(
  plan: CarePlan
): readonly ClinicalTimelineEntry[] {
  const goals = plan.goals.map((goal) =>
    createClinicalTimelineEntry({
      id: timelineEntryId('care_plan', plan.id, `goal:${goal.id}:${goal.status}`),
      organizationId: plan.organizationId,
      patientId: plan.patientId,
      authorizedProfessionalIds: [plan.professionalId],
      category: 'goal',
      importance: goal.status === 'achieved' ? 'milestone' : 'routine',
      occurredAt: plan.updatedAt,
      recordedAt: plan.updatedAt,
      title: goal.status === 'achieved' ? 'Meta terapêutica alcançada' : 'Meta terapêutica ativa',
      summary: goal.title,
      evidenceExcerpt: goal.title,
      tags: ['meta', goal.status],
      evidence: {
        sourceType: 'care_plan',
        sourceId: plan.id,
        sourceVersion: plan.version,
        sourceField: `goals.${goal.id}`,
      },
    })
  );
  const tasks = plan.tasks.map((task) =>
    createClinicalTimelineEntry({
      id: timelineEntryId('care_plan', plan.id, `task:${task.id}:${task.status}`),
      organizationId: plan.organizationId,
      patientId: plan.patientId,
      authorizedProfessionalIds: [plan.professionalId],
      category: 'task',
      importance: task.status === 'completed' ? 'milestone' : 'routine',
      occurredAt: task.completedAt ?? plan.updatedAt,
      recordedAt: plan.updatedAt,
      title: task.status === 'completed' ? 'Tarefa concluída' : 'Tarefa terapêutica atribuída',
      summary: task.title,
      evidenceExcerpt: task.title,
      tags: ['tarefa', task.status],
      evidence: {
        sourceType: 'care_plan',
        sourceId: plan.id,
        sourceVersion: plan.version,
        sourceField: `tasks.${task.id}`,
      },
    })
  );
  return [...goals, ...tasks];
}

export function projectHabitObservation(
  input: HabitObservationInput
): ClinicalTimelineEntry {
  return createClinicalTimelineEntry({
    id: timelineEntryId('habit_observation', input.id, input.status),
    organizationId: input.organizationId,
    patientId: input.patientId,
    authorizedProfessionalIds: input.professionalIds,
    category: 'habit',
    importance: input.status === 'completed' ? 'milestone' : 'routine',
    occurredAt: input.occurredAt,
    recordedAt: input.recordedAt,
    title: 'Acompanhamento de hábito',
    summary: `${input.habitLabel} • ${input.status.replaceAll('_', ' ')}.`,
    evidenceExcerpt: input.habitLabel,
    tags: ['hábito', input.status],
    evidence: {
      sourceType: 'habit_observation',
      sourceId: input.id,
      sourceVersion: input.sourceVersion,
      sourceField: 'status',
    },
  });
}

export function projectCareAlert(
  alert: CareAlert,
  professionalIds: readonly string[]
): ClinicalTimelineEntry {
  return createClinicalTimelineEntry({
    id: timelineEntryId('care_alert', alert.id, alert.status),
    organizationId: alert.organizationId,
    patientId: alert.patientId,
    authorizedProfessionalIds: professionalIds,
    category: 'alert',
    importance: alert.status === 'resolved' ? 'milestone' : 'attention',
    occurredAt: alert.acknowledgedAt ?? alert.createdAt,
    recordedAt: alert.acknowledgedAt ?? alert.createdAt,
    title: alert.status === 'resolved' ? 'Alerta resolvido' : 'Alerta para revisão humana',
    summary: `Tipo ${alert.type.replaceAll('_', ' ')} • Estado ${alert.status}.`,
    evidenceExcerpt: alert.note,
    tags: ['alerta', alert.type, alert.status],
    evidence: {
      sourceType: 'care_alert',
      sourceId: alert.id,
      sourceField: alert.note ? 'note' : 'status',
    },
  });
}
