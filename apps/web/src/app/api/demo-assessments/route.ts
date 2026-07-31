import {
  completeAssessment,
  createAssessmentAssignment,
  type AssessmentAssignment,
  type CompletedAssessment,
} from '@thats-life/core';
import { NextResponse } from 'next/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

interface DemoServerState {
  schemaVersion: 1;
  expiresAt: string;
  assignments: AssessmentAssignment[];
  responses: CompletedAssessment[];
}

interface DemoGlobal {
  __thatsLifeDemoAssessments?: DemoServerState;
}

const DEMO_TTL_MS = 8 * 60 * 60 * 1000;
const demoGlobal = globalThis as typeof globalThis & DemoGlobal;

function emptyState(): DemoServerState {
  return {
    schemaVersion: 1,
    expiresAt: new Date(Date.now() + DEMO_TTL_MS).toISOString(),
    assignments: [],
    responses: [],
  };
}

function getState(): DemoServerState {
  const current = demoGlobal.__thatsLifeDemoAssessments;
  if (!current || Date.parse(current.expiresAt) <= Date.now()) {
    demoGlobal.__thatsLifeDemoAssessments = emptyState();
  }
  return demoGlobal.__thatsLifeDemoAssessments!;
}

function saveState(state: DemoServerState): DemoServerState {
  const next = {
    ...state,
    expiresAt: new Date(Date.now() + DEMO_TTL_MS).toISOString(),
  };
  demoGlobal.__thatsLifeDemoAssessments = next;
  return next;
}

export async function GET() {
  return NextResponse.json(getState(), {
    headers: { 'Cache-Control': 'no-store' },
  });
}

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as Record<string, unknown>;
    const state = getState();

    if (body.type === 'assignment') {
      const candidate = body.assignment as AssessmentAssignment;
      const assignment = createAssessmentAssignment(candidate);
      return NextResponse.json(
        saveState({
          ...state,
          assignments: [
            assignment,
            ...state.assignments.filter((item) => item.id !== assignment.id),
          ],
        })
      );
    }

    if (body.type === 'completion') {
      const assignment = state.assignments.find(
        (item) => item.id === body.assignmentId
      );
      if (!assignment) throw new Error('Aplicação demonstrativa não encontrada.');
      const completed = completeAssessment({
        id: String(body.id ?? ''),
        assignment,
        answers: (body.answers ?? {}) as Record<string, number>,
        followUpAnswers: (body.followUpAnswers ?? {}) as Record<string, number>,
        completedAt: String(body.completedAt ?? ''),
      });
      return NextResponse.json(
        saveState({
          ...state,
          assignments: state.assignments.map((item) =>
            item.id === completed.assignment.id ? completed.assignment : item
          ),
          responses: [
            completed.response,
            ...state.responses.filter((item) => item.id !== completed.response.id),
          ],
        })
      );
    }

    throw new Error('Operação demonstrativa inválida.');
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Requisição inválida.' },
      { status: 400 }
    );
  }
}
