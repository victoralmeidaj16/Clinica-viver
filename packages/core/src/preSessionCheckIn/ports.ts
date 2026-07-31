import type {
  PreSessionCheckIn,
  PreSessionCheckInEvent,
  PreSessionCheckInStatus,
} from './types';

export interface PreSessionCheckInFilter {
  organizationId: string;
  patientId?: string;
  professionalId?: string;
  appointmentId?: string;
  statuses?: readonly PreSessionCheckInStatus[];
}

export interface CommitPreSessionCheckInInput {
  checkIn: PreSessionCheckIn;
  expectedVersion: number;
  commandId: string;
  events: readonly PreSessionCheckInEvent[];
}

export interface PreSessionCheckInRepository {
  getById(
    organizationId: string,
    checkInId: string
  ): Promise<PreSessionCheckIn | null>;
  list(filter: PreSessionCheckInFilter): Promise<readonly PreSessionCheckIn[]>;
  findByCommandId(
    organizationId: string,
    commandId: string
  ): Promise<PreSessionCheckIn | null>;
  commit(input: CommitPreSessionCheckInInput): Promise<void>;
}

export interface PreSessionNotificationPort {
  enqueueAvailableNotification(input: {
    organizationId: string;
    checkInId: string;
    patientId: string;
    availableFrom: string;
    expiresAt: string;
  }): Promise<void>;
}

export interface PreSessionAccessAuditPort {
  append(input: {
    id: string;
    organizationId: string;
    checkInId: string;
    actorUserId: string;
    action: 'pre_session_check_in.read' | 'pre_session_check_in.reviewed';
    occurredAt: string;
    correlationId: string;
  }): Promise<void>;
}
