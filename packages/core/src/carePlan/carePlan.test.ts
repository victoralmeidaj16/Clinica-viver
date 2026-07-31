import { describe, expect, it } from 'vitest';
import { addCareTask, completeCareTask, createCarePlan, recordMoodCheckIn } from './aggregate';
import { completeCareTaskAsPatient, completeCareTaskAsResponsible, recordMoodAsPatient } from './portal';

const plan = () => createCarePlan({
  id: 'plan-1', organizationId: 'org-1', patientId: 'patient-1', professionalId: 'professional-1',
  goals: [{ id: 'goal-1', title: 'Construir rotina de autocuidado', status: 'active' }], createdAt: '2026-08-01T10:00:00.000Z',
});

describe('care plan and patient follow-up', () => {
  it('mantém metas e tarefas compartilháveis separadas de conteúdo clínico', () => {
    const updated = addCareTask(plan(), { id: 'task-1', title: 'Registrar três momentos positivos do dia' }, '2026-08-01T10:01:00.000Z');
    expect(updated.tasks[0].patientVisible).toBe(true);
    expect(() => addCareTask(plan(), { id: 'task-2', title: 'Ler o prontuário SOAP antes da próxima sessão' }, '2026-08-01T10:01:00.000Z')).toThrow('restrito');
  });

  it('permite que o paciente conclua somente a própria tarefa', () => {
    const taskPlan = addCareTask(plan(), { id: 'task-1', title: 'Praticar respiração por cinco minutos' }, '2026-08-01T10:01:00.000Z');
    const completed = completeCareTaskAsPatient(taskPlan, { actorType: 'patient', organizationId: 'org-1', userId: 'user-patient', patientId: 'patient-1' }, 'task-1', '2026-08-01T10:02:00.000Z');
    expect(completed.tasks[0].status).toBe('completed');
    expect(() => completeCareTaskAsPatient(taskPlan, { actorType: 'patient', organizationId: 'org-1', userId: 'other', patientId: 'patient-2' }, 'task-1', '2026-08-01T10:02:00.000Z')).toThrow('patient_scope_mismatch');
  });

  it('exige permissão explícita do responsável e abre alerta para humor muito baixo', () => {
    const taskPlan = addCareTask(plan(), { id: 'task-1', title: 'Realizar uma atividade prazerosa' }, '2026-08-01T10:01:00.000Z');
    const responsible = { actorType: 'responsible' as const, organizationId: 'org-1', userId: 'user-responsible', responsiblePartyId: 'responsible-1' };
    const link = { id: 'link-1', organizationId: 'org-1', patientId: 'patient-1', responsiblePartyId: 'responsible-1', authority: 'legal_guardian' as const, canManageAppointments: true, canViewBilling: false, canAccessSharedClinicalContent: true, canManageTasks: false, canManageAssessments: false, activeFrom: '2026-01-01T00:00:00.000Z', createdAt: '2026-01-01T00:00:00.000Z' };
    expect(() => completeCareTaskAsResponsible(taskPlan, responsible, link, 'task-1', '2026-08-01T10:02:00.000Z')).toThrow('permission_missing');
    const result = recordMoodAsPatient({ actorType: 'patient', organizationId: 'org-1', userId: 'user-patient', patientId: 'patient-1' }, { id: 'mood-1', organizationId: 'org-1', patientId: 'patient-1', recordedAt: '2026-08-01T18:00:00.000Z', level: 1, emotions: ['tristeza'] });
    expect(result.alert).toMatchObject({ type: 'low_mood_pattern', status: 'open' });
  });

  it('não permite concluir a mesma tarefa duas vezes', () => {
    const taskPlan = addCareTask(plan(), { id: 'task-1', title: 'Caminhar por dez minutos' }, '2026-08-01T10:01:00.000Z');
    const completed = completeCareTask(taskPlan, 'task-1', '2026-08-01T10:02:00.000Z');
    expect(() => completeCareTask(completed, 'task-1', '2026-08-01T10:03:00.000Z')).toThrow('pendente');
  });
});
