import { describe, expect, it } from 'vitest';
import type { CompletedAssessment } from '../assessmentWorkflow';
import type { CarePlan } from '../carePlan';
import type { ClinicalRecord } from '../clinicalRecord';
import {
  InMemoryIdentityRepository,
  createPatientProfile,
  type StaffAccessContext,
} from '../identity';
import {
  InMemoryClinicalTimelineAccessAudit,
  InMemoryClinicalTimelineRepository,
  createClinicalTimelineEntry,
  listClinicalTimelineForStaff,
  projectApprovedClinicalRecord,
  projectCarePlan,
  projectCompletedAssessment,
  projectHabitObservation,
  projectMoodCheckIn,
  projectPreSessionCheckIn,
  searchClinicalTimeline,
  searchClinicalTimelineForStaff,
} from './index';

const organizationId = 'org-1';
const patientId = 'patient-1';
const professionalId = 'professional-1';

const actor: StaffAccessContext = {
  actorType: 'staff',
  organizationId,
  userId: 'user-professional',
  membershipId: 'membership-1',
  membershipStatus: 'active',
  roles: ['professional'],
  professionalProfileId: professionalId,
};

function approvedRecord(): ClinicalRecord {
  return {
    schemaVersion: 1,
    id: 'record-1',
    organizationId,
    patientId,
    sessionId: 'session-1',
    responsibleProfessionalId: professionalId,
    assignedProfessionalIds: [professionalId],
    status: 'approved',
    revisions: [{
      id: 'revision-1',
      revisionNumber: 1,
      kind: 'initial',
      source: 'manual',
      content: {
        subjective: 'Paciente relata dificuldade no trabalho desde a mudança de liderança.',
        objective: 'Relato organizado e coerente durante a sessão.',
        assessment: 'Sobrecarga profissional permanece como tema recorrente.',
        plan: 'Revisar limites profissionais na próxima sessão.',
        extractedTasks: [],
      },
      createdByUserId: actor.userId,
      createdAt: '2026-06-03T14:00:00.000Z',
    }],
    approvals: [{
      id: 'approval-1',
      revisionNumber: 1,
      professionalId,
      approvedByUserId: actor.userId,
      approvedAt: '2026-06-03T15:00:00.000Z',
      contentHashSha256: 'a'.repeat(64),
      attestation: 'reviewed_and_approved_by_professional',
    }],
    currentApprovedRevisionNumber: 1,
    retentionUntil: '2031-06-03T15:00:00.000Z',
    legalHold: false,
    version: 2,
    createdAt: '2026-06-03T14:00:00.000Z',
    updatedAt: '2026-06-03T15:00:00.000Z',
  };
}

function identities() {
  return new InMemoryIdentityRepository({
    patients: [createPatientProfile({
      id: patientId,
      organizationId,
      displayName: 'Paciente Fictício',
      primaryProfessionalId: professionalId,
      assignedProfessionalIds: [professionalId],
      createdAt: '2026-01-01T10:00:00.000Z',
    })],
  });
}

describe('clinical timeline projections', () => {
  it('projeta somente revisão aprovada com campo, versão e hash verificáveis', () => {
    const entries = projectApprovedClinicalRecord(approvedRecord());
    expect(entries).toHaveLength(4);
    expect(entries[0]).toMatchObject({
      category: 'clinical_record',
      evidenceExcerpt: 'Paciente relata dificuldade no trabalho desde a mudança de liderança.',
      evidence: {
        sourceType: 'clinical_record_revision',
        sourceId: 'record-1',
        sourceVersion: 2,
        sourceRevisionId: 'revision-1',
        sourceField: 'content.subjective',
        contentHashSha256: 'a'.repeat(64),
      },
    });

    expect(projectApprovedClinicalRecord({
      ...approvedRecord(),
      status: 'draft',
      currentApprovedRevisionNumber: undefined,
    })).toEqual([]);
  });

  it('unifica avaliações, humor, hábitos, tarefas, metas e check-in sem perder a origem', () => {
    const assessment: CompletedAssessment = {
      schemaVersion: 1,
      id: 'assessment-1',
      assignmentId: 'assignment-1',
      instrumentCode: 'GAD-7',
      patientId,
      appliedAt: '2026-07-01T10:00:00.000Z',
      completedAt: '2026-07-01T10:05:00.000Z',
      answers: {},
      followUpAnswers: {},
      totalScore: 12,
      severityLabel: 'Moderada',
      hasRiskAlert: false,
    };
    const plan: CarePlan = {
      schemaVersion: 1,
      id: 'plan-1',
      organizationId,
      patientId,
      professionalId,
      goals: [{ id: 'goal-1', title: 'Estabelecer limites profissionais', status: 'active' }],
      tasks: [{
        id: 'task-1',
        title: 'Registrar situações de sobrecarga',
        status: 'completed',
        patientVisible: true,
        completedAt: '2026-07-03T18:00:00.000Z',
      }],
      status: 'active',
      version: 3,
      createdAt: '2026-07-01T10:00:00.000Z',
      updatedAt: '2026-07-03T18:00:00.000Z',
    };
    const entries = [
      projectCompletedAssessment(assessment, {
        organizationId,
        professionalIds: [professionalId],
      }),
      projectMoodCheckIn({
        id: 'mood-1',
        organizationId,
        patientId,
        recordedAt: '2026-07-02T18:00:00.000Z',
        level: 2,
        emotions: ['ansiedade'],
      }, [professionalId]),
      projectHabitObservation({
        id: 'habit-1',
        organizationId,
        patientId,
        professionalIds: [professionalId],
        habitLabel: 'Respiração diafragmática',
        status: 'completed',
        occurredAt: '2026-07-02T08:00:00.000Z',
        recordedAt: '2026-07-02T08:01:00.000Z',
      }),
      ...projectCarePlan(plan),
      ...projectPreSessionCheckIn({
        schemaVersion: 1,
        id: 'pre-session-1',
        organizationId,
        appointmentId: 'appointment-1',
        patientId,
        professionalId,
        availableFrom: '2026-07-04T10:00:00.000Z',
        expiresAt: '2026-07-05T10:00:00.000Z',
        status: 'submitted',
        response: {
          moodLevel: 3,
          topicsToDiscuss: 'Gostaria de conversar sobre trabalho.',
        },
        reviewReasons: [],
        submittedAt: '2026-07-04T12:00:00.000Z',
        version: 2,
        createdAt: '2026-07-04T10:00:00.000Z',
        updatedAt: '2026-07-04T12:00:00.000Z',
      }),
    ];

    expect(new Set(entries.map((entry) => entry.category))).toEqual(
      new Set(['assessment', 'mood', 'habit', 'goal', 'task', 'pre_session'])
    );
    expect(entries.every((entry) => Boolean(entry.evidence.sourceId))).toBe(true);
  });
});

describe('verifiable clinical memory', () => {
  it('encontra a primeira evidência exata sem gerar conteúdo novo', () => {
    const entries = projectApprovedClinicalRecord(approvedRecord());
    const later = createClinicalTimelineEntry({
      id: 'timeline-later',
      organizationId,
      patientId,
      authorizedProfessionalIds: [professionalId],
      category: 'pre_session',
      importance: 'routine',
      occurredAt: '2026-07-29T12:00:00.000Z',
      recordedAt: '2026-07-29T12:00:00.000Z',
      title: 'Assunto informado antes da sessão',
      summary: 'Texto enviado pelo paciente.',
      evidenceExcerpt: 'Quero retomar as dificuldades no trabalho.',
      tags: ['pré-sessão'],
      evidence: {
        sourceType: 'pre_session_check_in',
        sourceId: 'pre-session-later',
        sourceField: 'response.topicsToDiscuss',
      },
    });
    const result = searchClinicalTimeline(
      [...entries, later],
      'Quando começou a relatar dificuldades no trabalho?'
    );

    expect(result.mode).toBe('evidence_only');
    expect(result.firstEvidenceAt).toBe('2026-06-03T15:00:00.000Z');
    expect(result.matches[0].entry.evidenceExcerpt).toContain('trabalho');
    expect(JSON.stringify(result)).not.toContain('resposta gerada');
  });

  it('aplica autorização, registra auditoria sem armazenar a consulta e faz upsert idempotente', async () => {
    const entries = projectApprovedClinicalRecord(approvedRecord());
    const timelines = new InMemoryClinicalTimelineRepository();
    await timelines.upsert(entries);
    await timelines.upsert(entries);
    const audit = new InMemoryClinicalTimelineAccessAudit();
    const dependencies = { timelines, identities: identities(), audit };
    const metadata = {
      occurredAt: '2026-07-30T10:00:00.000Z',
      correlationId: 'timeline-query-1',
    };

    expect(await listClinicalTimelineForStaff(
      dependencies,
      actor,
      { patientId },
      metadata
    )).toHaveLength(4);
    const search = await searchClinicalTimelineForStaff(
      dependencies,
      actor,
      { patientId, query: 'trabalho' },
      { ...metadata, correlationId: 'timeline-search-1' }
    );
    expect(search.matches.length).toBeGreaterThan(0);
    expect(audit.listEvents()).toHaveLength(2);
    expect(JSON.stringify(audit.listEvents())).not.toContain('trabalho');

    await expect(listClinicalTimelineForStaff(
      dependencies,
      { ...actor, professionalProfileId: 'other-professional' },
      { patientId },
      { ...metadata, correlationId: 'denied' }
    )).rejects.toThrow('professional_not_assigned');
  });
});
