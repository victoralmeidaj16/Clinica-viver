import type { CareAlert, CarePlan, CareTask, MoodCheckIn, TherapeuticGoal } from './types';

function text(value: string, field: string): string { const normalized = value.replace(/\s+/g, ' ').trim(); if (!normalized) throw new Error(`${field} é obrigatório.`); return normalized; }
function iso(value: string, field: string): string { if (Number.isNaN(Date.parse(value))) throw new Error(`${field} deve ser uma data ISO válida.`); return value; }
function sharedText(value: string, field: string): string {
  const normalized = text(value, field);
  if (/\b(?:soap|prontu[aá]rio|diagn[oó]stico|suic[ií]dio|autoles[aã]o)\b/i.test(normalized)) throw new Error(`${field} contém conteúdo clínico restrito ao paciente.`);
  return normalized;
}

export function createCarePlan(input: { id: string; organizationId: string; patientId: string; professionalId: string; goals: readonly TherapeuticGoal[]; createdAt: string }): CarePlan {
  const createdAt = iso(input.createdAt, 'createdAt');
  const goals = input.goals.map((goal) => ({ ...goal, id: text(goal.id, 'goal.id'), title: sharedText(goal.title, 'goal.title'), targetDate: goal.targetDate ? iso(goal.targetDate, 'targetDate') : undefined }));
  return { schemaVersion: 1, id: text(input.id, 'id'), organizationId: text(input.organizationId, 'organizationId'), patientId: text(input.patientId, 'patientId'), professionalId: text(input.professionalId, 'professionalId'), goals, tasks: [], status: 'active', version: 1, createdAt, updatedAt: createdAt };
}

export function addCareTask(plan: CarePlan, input: { id: string; title: string; dueAt?: string }, occurredAt: string): CarePlan {
  if (plan.status !== 'active') throw new Error('O plano está arquivado.');
  if (plan.tasks.some((task) => task.id === input.id)) throw new Error('task.id já utilizado.');
  const updatedAt = iso(occurredAt, 'occurredAt');
  const task: CareTask = { id: text(input.id, 'task.id'), title: sharedText(input.title, 'task.title'), dueAt: input.dueAt ? iso(input.dueAt, 'dueAt') : undefined, status: 'pending', patientVisible: true };
  return { ...plan, tasks: [...plan.tasks, task], version: plan.version + 1, updatedAt };
}

export function completeCareTask(plan: CarePlan, taskId: string, occurredAt: string): CarePlan {
  const updatedAt = iso(occurredAt, 'occurredAt');
  let found = false;
  const tasks = plan.tasks.map((task) => {
    if (task.id !== taskId) return task;
    found = true;
    if (task.status !== 'pending') throw new Error('Somente uma tarefa pendente pode ser concluída.');
    return { ...task, status: 'completed' as const, completedAt: updatedAt };
  });
  if (!found) throw new Error('Tarefa não encontrada.');
  return { ...plan, tasks, version: plan.version + 1, updatedAt };
}

export function recordMoodCheckIn(input: MoodCheckIn): { checkIn: MoodCheckIn; alert?: CareAlert } {
  const recordedAt = iso(input.recordedAt, 'recordedAt');
  if (!Number.isInteger(input.level) || input.level < 1 || input.level > 5) throw new Error('level deve estar entre 1 e 5.');
  const checkIn = { ...input, id: text(input.id, 'id'), organizationId: text(input.organizationId, 'organizationId'), patientId: text(input.patientId, 'patientId'), recordedAt, emotions: Array.from(new Set(input.emotions.map((emotion) => text(emotion, 'emotion')))), note: input.note ? text(input.note, 'note') : undefined };
  return input.level === 1 ? { checkIn, alert: { id: `alert-${checkIn.id}`, organizationId: checkIn.organizationId, patientId: checkIn.patientId, type: 'low_mood_pattern', status: 'open', createdAt: recordedAt } } : { checkIn };
}

export function acknowledgeCareAlert(alert: CareAlert, actorUserId: string, occurredAt: string): CareAlert {
  if (alert.status !== 'open') throw new Error('Somente alertas abertos podem ser reconhecidos.');
  return { ...alert, status: 'acknowledged', acknowledgedByUserId: text(actorUserId, 'actorUserId'), acknowledgedAt: iso(occurredAt, 'occurredAt') };
}
