import { authorizePatientSelf, authorizeResponsible, type PatientAccessContext, type PatientResponsibleLink, type ResponsibleAccessContext } from '../identity';
import { completeCareTask, recordMoodCheckIn } from './aggregate';
import type { CarePlan, MoodCheckIn } from './types';

export function completeCareTaskAsPatient(plan: CarePlan, actor: PatientAccessContext, taskId: string, occurredAt: string): CarePlan {
  const decision = authorizePatientSelf(actor, { organizationId: plan.organizationId, patientId: plan.patientId });
  if (!decision.allowed) throw new Error(`Acesso negado: ${decision.reason}.`);
  return completeCareTask(plan, taskId, occurredAt);
}

export function completeCareTaskAsResponsible(plan: CarePlan, actor: ResponsibleAccessContext, link: PatientResponsibleLink, taskId: string, occurredAt: string): CarePlan {
  const decision = authorizeResponsible(actor, link, 'tasks.write', { organizationId: plan.organizationId, patientId: plan.patientId }, occurredAt);
  if (!decision.allowed) throw new Error(`Acesso negado: ${decision.reason}.`);
  return completeCareTask(plan, taskId, occurredAt);
}

export function recordMoodAsPatient(actor: PatientAccessContext, input: MoodCheckIn) {
  const decision = authorizePatientSelf(actor, { organizationId: input.organizationId, patientId: input.patientId });
  if (!decision.allowed) throw new Error(`Acesso negado: ${decision.reason}.`);
  return recordMoodCheckIn(input);
}
