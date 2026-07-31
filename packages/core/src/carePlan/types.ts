export interface TherapeuticGoal {
  id: string;
  title: string;
  status: 'active' | 'achieved' | 'archived';
  targetDate?: string;
}

export interface CareTask {
  id: string;
  title: string;
  dueAt?: string;
  status: 'pending' | 'completed' | 'cancelled';
  patientVisible: true;
  completedAt?: string;
}

export interface CarePlan {
  schemaVersion: 1;
  id: string;
  organizationId: string;
  patientId: string;
  professionalId: string;
  goals: readonly TherapeuticGoal[];
  tasks: readonly CareTask[];
  status: 'active' | 'archived';
  version: number;
  createdAt: string;
  updatedAt: string;
}

export interface MoodCheckIn {
  id: string;
  organizationId: string;
  patientId: string;
  recordedAt: string;
  level: 1 | 2 | 3 | 4 | 5;
  emotions: readonly string[];
  note?: string;
}

export interface CareAlert {
  id: string;
  organizationId: string;
  patientId: string;
  type: 'low_mood_pattern' | 'assessment_risk' | 'manual_review';
  status: 'open' | 'acknowledged' | 'resolved';
  createdAt: string;
  acknowledgedByUserId?: string;
  acknowledgedAt?: string;
  note?: string;
}
