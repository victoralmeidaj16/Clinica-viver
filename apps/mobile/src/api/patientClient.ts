import type { PatientHandoff } from '@thats-life/core';
import { DEMO_PATIENT_HANDOFF } from '../data/demoPatientHandoff';

export interface PatientPortalData {
  patient: {
    id: string;
    displayName: string;
  };
  nextAppointment: {
    id: string;
    startsAt: string;
    endsAt: string;
    mode: string;
    status: string;
  } | null;
  handoff: PatientHandoff | null;
  tasks: Array<{ id: string; title: string; completed: boolean }>;
  moodLogs: Array<{
    id: string;
    recordedAt: string;
    level: number;
    emotions: string[];
    note?: string;
  }>;
  pendingAssessment: {
    id: string;
    type: string;
    title: string;
    description: string;
    status: 'pending' | 'completed';
  };
}

const DEFAULT_API_BASE = 'http://localhost:3000';
const DEMO_HEADERS = {
  'Content-Type': 'application/json',
  'X-Organization-Id': 'org-demo',
  'X-Patient-Id': 'pac-01',
};

// Internal fallback state for offline / isolated client mode
let fallbackPortalData: PatientPortalData = {
  patient: { id: 'pac-01', displayName: 'Mariana Costa' },
  nextAppointment: {
    id: 'appointment-pac-01',
    startsAt: '2026-08-03T14:00:00.000Z',
    endsAt: '2026-08-03T14:50:00.000Z',
    mode: 'video',
    status: 'confirmed',
  },
  handoff: DEMO_PATIENT_HANDOFF,
  tasks: DEMO_PATIENT_HANDOFF.tasks.map((t) => ({ ...t })),
  moodLogs: [
    {
      id: 'mood-pac-1',
      recordedAt: '2026-07-30T20:00:00.000Z',
      level: 4,
      emotions: ['Tranquila', 'Focada'],
      note: 'Dia produtivo no trabalho.',
    },
  ],
  pendingAssessment: {
    id: 'assessment-pre-session-pac-01',
    type: 'PHQ-9 / GAD-7',
    title: 'Avaliação Pré-Sessão',
    description: 'Responda algumas perguntas rápidas sobre seu bem-estar nos últimos dias.',
    status: 'pending',
  },
};

export async function fetchPatientPortal(): Promise<PatientPortalData> {
  try {
    const res = await fetch(`${DEFAULT_API_BASE}/api/application/patient/portal`, {
      method: 'GET',
      headers: DEMO_HEADERS,
    });
    if (!res.ok) throw new Error(`HTTP error ${res.status}`);
    const json = await res.json();
    if (json.ok && json.data) {
      fallbackPortalData = json.data;
      return json.data;
    }
  } catch {
    // Fallback gracioso para modo offline / demonstração
  }
  return fallbackPortalData;
}

export async function togglePatientTaskRemote(
  taskId: string
): Promise<{ tasks: Array<{ id: string; title: string; completed: boolean }> }> {
  const idempotencyKey = `mob-task-${taskId}-${Date.now()}`;
  try {
    const res = await fetch(
      `${DEFAULT_API_BASE}/api/application/patient/tasks/${encodeURIComponent(taskId)}/toggle`,
      {
        method: 'POST',
        headers: {
          ...DEMO_HEADERS,
          'Idempotency-Key': idempotencyKey,
        },
      }
    );
    if (!res.ok) throw new Error(`HTTP error ${res.status}`);
    const json = await res.json();
    if (json.ok && json.data) {
      return json.data;
    }
  } catch {
    // Fallback local
  }

  fallbackPortalData.tasks = fallbackPortalData.tasks.map((t) =>
    t.id === taskId ? { ...t, completed: !t.completed } : t
  );
  return { tasks: fallbackPortalData.tasks };
}

export async function recordPatientMoodRemote(input: {
  level: 1 | 2 | 3 | 4 | 5;
  emotions: string[];
  note?: string;
}): Promise<boolean> {
  const idempotencyKey = `mob-mood-${Date.now()}`;
  try {
    const res = await fetch(`${DEFAULT_API_BASE}/api/application/patient/mood`, {
      method: 'POST',
      headers: {
        ...DEMO_HEADERS,
        'Idempotency-Key': idempotencyKey,
      },
      body: JSON.stringify(input),
    });
    if (!res.ok) throw new Error(`HTTP error ${res.status}`);
    const json = await res.json();
    if (json.ok) return true;
  } catch {
    // Fallback local
  }

  fallbackPortalData.moodLogs.unshift({
    id: `mood-local-${Date.now()}`,
    recordedAt: new Date().toISOString(),
    level: input.level,
    emotions: input.emotions,
    note: input.note,
  });
  return true;
}

export async function submitPatientAssessmentRemote(input: {
  type: string;
  answers: Record<string, number>;
}): Promise<boolean> {
  const idempotencyKey = `mob-assess-${Date.now()}`;
  try {
    const res = await fetch(`${DEFAULT_API_BASE}/api/application/patient/assessments`, {
      method: 'POST',
      headers: {
        ...DEMO_HEADERS,
        'Idempotency-Key': idempotencyKey,
      },
      body: JSON.stringify(input),
    });
    if (!res.ok) throw new Error(`HTTP error ${res.status}`);
    const json = await res.json();
    if (json.ok) {
      fallbackPortalData.pendingAssessment.status = 'completed';
      return true;
    }
  } catch {
    // Fallback local
  }

  fallbackPortalData.pendingAssessment.status = 'completed';
  return true;
}

export async function submitPreSessionCheckInRemote(input: {
  appointmentId?: string;
  topicsToDiscuss?: string;
  moodLevel?: 1 | 2 | 3 | 4 | 5;
  assessment?: {
    responseId: string;
    instrumentCode: string;
    totalScore: number;
    severityLabel: string;
    hasRiskAlert: boolean;
    riskAlertReason?: string;
  };
}): Promise<boolean> {
  const idempotencyKey = `mob-presession-${Date.now()}`;
  try {
    const res = await fetch(`${DEFAULT_API_BASE}/api/application/patient/pre-session`, {
      method: 'POST',
      headers: {
        ...DEMO_HEADERS,
        'Idempotency-Key': idempotencyKey,
      },
      body: JSON.stringify(input),
    });
    if (!res.ok) throw new Error(`HTTP error ${res.status}`);
    const json = await res.json();
    if (json.ok) {
      fallbackPortalData.pendingAssessment.status = 'completed';
      return true;
    }
  } catch {
    // Fallback local
  }

  fallbackPortalData.pendingAssessment.status = 'completed';
  return true;
}

