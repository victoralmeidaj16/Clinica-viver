import type {
  AssessmentAssignment,
  CompletedAssessment,
} from '@thats-life/core';

export interface DemoAssessmentState {
  schemaVersion: 1;
  expiresAt: string;
  assignments: AssessmentAssignment[];
  responses: CompletedAssessment[];
}

const EMPTY_STATE: DemoAssessmentState = {
  schemaVersion: 1,
  expiresAt: '',
  assignments: [],
  responses: [],
};

let snapshot = EMPTY_STATE;
let loadPromise: Promise<void> | null = null;
const listeners = new Set<() => void>();

function emit(next: DemoAssessmentState): void {
  snapshot = next;
  listeners.forEach((listener) => listener());
}

function loadFromServer(): void {
  if (loadPromise || typeof window === 'undefined') return;
  loadPromise = fetch('/api/demo-assessments', { cache: 'no-store' })
    .then(async (response) => {
      if (!response.ok) throw new Error('Falha ao carregar avaliações demonstrativas.');
      emit((await response.json()) as DemoAssessmentState);
    })
    .catch(() => emit(EMPTY_STATE));
}

async function postDemoMutation(body: object): Promise<void> {
  const response = await fetch('/api/demo-assessments', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  if (!response.ok) throw new Error('Falha ao salvar avaliação demonstrativa.');
  emit((await response.json()) as DemoAssessmentState);
}

export function subscribeDemoAssessments(listener: () => void): () => void {
  listeners.add(listener);
  loadFromServer();
  return () => listeners.delete(listener);
}

export function getDemoAssessmentSnapshot(): DemoAssessmentState {
  loadFromServer();
  return snapshot;
}

export function getDemoAssessmentServerSnapshot(): DemoAssessmentState {
  return EMPTY_STATE;
}

export function saveDemoAssignment(assignment: AssessmentAssignment): void {
  emit({
    ...snapshot,
    assignments: [
      assignment,
      ...snapshot.assignments.filter((item) => item.id !== assignment.id),
    ],
  });
  void postDemoMutation({ type: 'assignment', assignment }).catch(() => undefined);
}

export function saveDemoCompletion(
  assignment: AssessmentAssignment,
  response: CompletedAssessment
): void {
  emit({
    ...snapshot,
    assignments: snapshot.assignments.map((item) =>
      item.id === assignment.id ? assignment : item
    ),
    responses: [
      response,
      ...snapshot.responses.filter((item) => item.id !== response.id),
    ],
  });
  void postDemoMutation({
    type: 'completion',
    id: response.id,
    assignmentId: assignment.id,
    answers: response.answers,
    followUpAnswers: response.followUpAnswers,
    completedAt: response.completedAt,
  }).catch(() => undefined);
}
