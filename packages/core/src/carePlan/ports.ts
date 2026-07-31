import type { CareAlert, CarePlan, MoodCheckIn } from './types';

export interface CarePlanRepository {
  getById(organizationId: string, planId: string): Promise<CarePlan | null>;
  listByPatient(organizationId: string, patientId: string): Promise<readonly CarePlan[]>;
  save(plan: CarePlan, expectedVersion: number): Promise<void>;
}

export interface MoodCheckInRepository {
  append(checkIn: MoodCheckIn): Promise<void>;
  listByPatient(input: { organizationId: string; patientId: string; from?: string; until?: string }): Promise<readonly MoodCheckIn[]>;
}

export interface CareAlertRepository {
  getById(organizationId: string, alertId: string): Promise<CareAlert | null>;
  listOpen(organizationId: string, patientId?: string): Promise<readonly CareAlert[]>;
  save(alert: CareAlert): Promise<void>;
}
