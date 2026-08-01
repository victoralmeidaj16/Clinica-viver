import { describe, expect, it } from 'vitest';
import {
  authorizePatientSelf,
  completeCareTaskAsPatient,
  createCarePlan,
  addCareTask,
  recordMoodAsPatient,
  type PatientAccessContext,
} from './index';

describe('Fluxo e Autorização do Portal do Paciente', () => {
  const organizationId = 'org-demo';
  const patientId = 'patient-1';
  const otherPatientId = 'patient-other';
  const occurredAt = '2026-07-31T12:00:00.000Z';

  const actorContext: PatientAccessContext = {
    actorType: 'patient',
    organizationId,
    userId: 'user-patient-demo',
    patientId,
  };

  it('permite o acesso do próprio paciente aos seus recursos', () => {
    const decision = authorizePatientSelf(actorContext, {
      organizationId,
      patientId,
    });
    expect(decision.allowed).toBe(true);
    expect(decision.reason).toBe('allowed');
  });

  it('bloqueia o acesso a dados de outro paciente (cross-patient isolation)', () => {
    const decision = authorizePatientSelf(actorContext, {
      organizationId,
      patientId: otherPatientId,
    });
    expect(decision.allowed).toBe(false);
    expect(decision.reason).toBe('patient_scope_mismatch');
  });

  it('bloqueia o acesso a dados de outra organização (cross-tenant isolation)', () => {
    const decision = authorizePatientSelf(actorContext, {
      organizationId: 'other-org',
      patientId,
    });
    expect(decision.allowed).toBe(false);
    expect(decision.reason).toBe('cross_tenant');
  });

  it('permite que o paciente conclua tarefas terapêuticas do seu plano', () => {
    const basePlan = createCarePlan({
      id: 'plan-test',
      organizationId,
      patientId,
      professionalId: 'professional-1',
      goals: [],
      createdAt: occurredAt,
    });

    const planWithTask = addCareTask(
      basePlan,
      { id: 'task-test-1', title: 'Praticar respiração diafragmática' },
      occurredAt
    );

    const updatedPlan = completeCareTaskAsPatient(
      planWithTask,
      actorContext,
      'task-test-1',
      occurredAt
    );

    const task = updatedPlan.tasks.find((t) => t.id === 'task-test-1');
    expect(task?.status).toBe('completed');
    expect(task?.completedAt).toBe(occurredAt);
  });

  it('impede que o paciente conclua tarefas de outro paciente', () => {
    const basePlan = createCarePlan({
      id: 'plan-test-other',
      organizationId,
      patientId: otherPatientId,
      professionalId: 'professional-1',
      goals: [],
      createdAt: occurredAt,
    });

    const planWithTask = addCareTask(
      basePlan,
      { id: 'task-test-2', title: 'Registrar diário de pensamentos' },
      occurredAt
    );

    expect(() =>
      completeCareTaskAsPatient(
        planWithTask,
        actorContext,
        'task-test-2',
        occurredAt
      )
    ).toThrow('Acesso negado: patient_scope_mismatch.');
  });

  it('permite o registro diário de humor com alerta automático se o nível for 1 (muito mal)', () => {
    const { checkIn, alert } = recordMoodAsPatient(actorContext, {
      id: 'mood-check-1',
      organizationId,
      patientId,
      recordedAt: occurredAt,
      level: 1,
      emotions: ['Tristeza', 'Cansaço'],
      note: 'Dia muito difícil.',
    });

    expect(checkIn.level).toBe(1);
    expect(alert).toBeDefined();
    expect(alert?.type).toBe('low_mood_pattern');
    expect(alert?.status).toBe('open');
  });
});
