import {
  calculateAssessmentScore,
  isSupportedAssessmentCode,
} from './assessments';
import type {
  AssessmentResponse,
  SupportedAssessmentCode,
} from './assessmentTypes';

export type AssessmentAssignmentStatus = 'pending' | 'completed' | 'cancelled';

export interface AssessmentAssignment {
  id: string;
  patientId: string;
  instrumentCode: SupportedAssessmentCode;
  assignedAt: string;
  status: AssessmentAssignmentStatus;
  completedAt?: string;
}

export interface CompletedAssessment extends AssessmentResponse {
  schemaVersion: 1;
  assignmentId: string;
  completedAt: string;
  followUpAnswers: Record<string, number>;
}

export interface CreateAssessmentAssignmentInput {
  id: string;
  patientId: string;
  instrumentCode: string;
  assignedAt: string;
}

export interface CompleteAssessmentInput {
  id: string;
  assignment: AssessmentAssignment;
  answers: Record<string, number>;
  followUpAnswers?: Record<string, number>;
  completedAt: string;
}

function assertNonEmpty(value: string, field: string): void {
  if (!value.trim()) throw new Error(`${field} é obrigatório.`);
}

function assertIsoDate(value: string, field: string): void {
  if (Number.isNaN(Date.parse(value))) throw new Error(`${field} deve ser uma data ISO válida.`);
}

export function createAssessmentAssignment(
  input: CreateAssessmentAssignmentInput
): AssessmentAssignment {
  assertNonEmpty(input.id, 'id');
  assertNonEmpty(input.patientId, 'patientId');
  assertIsoDate(input.assignedAt, 'assignedAt');
  if (!isSupportedAssessmentCode(input.instrumentCode)) {
    throw new Error(`Instrumento ${input.instrumentCode} ainda não está disponível para aplicação.`);
  }

  return {
    id: input.id,
    patientId: input.patientId,
    instrumentCode: input.instrumentCode,
    assignedAt: input.assignedAt,
    status: 'pending',
  };
}

export function completeAssessment(
  input: CompleteAssessmentInput
): { assignment: AssessmentAssignment; response: CompletedAssessment } {
  if (input.assignment.status !== 'pending') {
    throw new Error('Somente uma aplicação pendente pode ser concluída.');
  }
  assertNonEmpty(input.id, 'id');
  assertIsoDate(input.completedAt, 'completedAt');

  const score = calculateAssessmentScore(
    input.assignment.instrumentCode,
    input.answers
  );
  const response: CompletedAssessment = {
    schemaVersion: 1,
    id: input.id,
    assignmentId: input.assignment.id,
    instrumentCode: input.assignment.instrumentCode,
    patientId: input.assignment.patientId,
    appliedAt: input.assignment.assignedAt,
    completedAt: input.completedAt,
    answers: { ...input.answers },
    followUpAnswers: { ...input.followUpAnswers },
    ...score,
  };

  return {
    assignment: {
      ...input.assignment,
      status: 'completed',
      completedAt: input.completedAt,
    },
    response,
  };
}

export function getActiveRiskAlerts(
  responses: readonly CompletedAssessment[]
): CompletedAssessment[] {
  return responses
    .filter((response) => response.hasRiskAlert)
    .sort((a, b) => b.completedAt.localeCompare(a.completedAt));
}
