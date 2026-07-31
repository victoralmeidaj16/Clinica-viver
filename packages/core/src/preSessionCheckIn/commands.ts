import {
  assertStaffAuthorized,
  authorizePatientSelf,
  type PatientAccessContext,
  type StaffAccessContext,
} from '../identity';
import type { AppointmentRepository } from '../scheduling';
import {
  reviewPreSessionCheckIn,
  schedulePreSessionCheckIn,
  startPreSessionCheckIn,
  submitPreSessionCheckIn,
} from './aggregate';
import type { PreSessionCheckInRepository } from './ports';
import type {
  PreSessionCheckIn,
  PreSessionCheckInResponse,
  PreSessionCommandMetadata,
  PreSessionTransitionResult,
} from './types';

export interface PreSessionDependencies {
  checkIns: PreSessionCheckInRepository;
  appointments: AppointmentRepository;
}

export interface PersistedPreSessionMetadata extends PreSessionCommandMetadata {
  commandId: string;
}

export interface PreSessionCommandResult {
  checkIn: PreSessionCheckIn;
  idempotentReplay: boolean;
}

async function replay(
  repository: PreSessionCheckInRepository,
  organizationId: string,
  commandId: string
): Promise<PreSessionCommandResult | null> {
  const checkIn = await repository.findByCommandId(organizationId, commandId);
  return checkIn ? { checkIn, idempotentReplay: true } : null;
}

async function persist(
  repository: PreSessionCheckInRepository,
  result: PreSessionTransitionResult,
  expectedVersion: number,
  commandId: string
): Promise<PreSessionCommandResult> {
  await repository.commit({
    checkIn: result.checkIn,
    expectedVersion,
    commandId,
    events: result.events,
  });
  return { checkIn: result.checkIn, idempotentReplay: false };
}

export async function schedulePreSessionCheckInCommand(
  dependencies: PreSessionDependencies,
  actor: StaffAccessContext,
  input: {
    id: string;
    appointmentId: string;
    availableFrom: string;
    expiresAt: string;
  },
  metadata: PersistedPreSessionMetadata
): Promise<PreSessionCommandResult> {
  const replayed = await replay(
    dependencies.checkIns,
    actor.organizationId,
    metadata.commandId
  );
  if (replayed) return replayed;

  const appointment = await dependencies.appointments.getById(
    actor.organizationId,
    input.appointmentId
  );
  if (!appointment) throw new Error('Agendamento não encontrado na organização.');
  if (!['scheduled', 'confirmed'].includes(appointment.status)) {
    throw new Error('O agendamento não aceita um novo check-in pré-sessão.');
  }
  assertStaffAuthorized(actor, 'assessments.assign', {
    organizationId: appointment.organizationId,
    patientId: appointment.patientId,
    assignedProfessionalIds: [appointment.professionalId],
  });

  const existing = await dependencies.checkIns.list({
    organizationId: actor.organizationId,
    appointmentId: appointment.id,
  });
  if (existing.length > 0) {
    throw new Error('O agendamento já possui um check-in pré-sessão.');
  }

  const result = schedulePreSessionCheckIn(
    {
      ...input,
      organizationId: appointment.organizationId,
      patientId: appointment.patientId,
      professionalId: appointment.professionalId,
      createdAt: metadata.occurredAt,
    },
    metadata
  );
  return persist(dependencies.checkIns, result, 0, metadata.commandId);
}

async function patientTransition(
  repository: PreSessionCheckInRepository,
  actor: PatientAccessContext,
  checkInId: string,
  metadata: PersistedPreSessionMetadata,
  transition: (checkIn: PreSessionCheckIn) => PreSessionTransitionResult
): Promise<PreSessionCommandResult> {
  const replayed = await replay(
    repository,
    actor.organizationId,
    metadata.commandId
  );
  if (replayed) return replayed;

  const checkIn = await repository.getById(actor.organizationId, checkInId);
  if (!checkIn) throw new Error('Check-in pré-sessão não encontrado.');
  const decision = authorizePatientSelf(actor, {
    organizationId: checkIn.organizationId,
    patientId: checkIn.patientId,
  });
  if (!decision.allowed) throw new Error(`Acesso negado: ${decision.reason}.`);

  return persist(
    repository,
    transition(checkIn),
    checkIn.version,
    metadata.commandId
  );
}

export function startPreSessionCheckInCommand(
  dependencies: Pick<PreSessionDependencies, 'checkIns'>,
  actor: PatientAccessContext,
  checkInId: string,
  metadata: PersistedPreSessionMetadata
): Promise<PreSessionCommandResult> {
  return patientTransition(
    dependencies.checkIns,
    actor,
    checkInId,
    metadata,
    (checkIn) => startPreSessionCheckIn(checkIn, metadata)
  );
}

export function submitPreSessionCheckInCommand(
  dependencies: Pick<PreSessionDependencies, 'checkIns'>,
  actor: PatientAccessContext,
  checkInId: string,
  response: PreSessionCheckInResponse,
  metadata: PersistedPreSessionMetadata
): Promise<PreSessionCommandResult> {
  return patientTransition(
    dependencies.checkIns,
    actor,
    checkInId,
    metadata,
    (checkIn) => submitPreSessionCheckIn(checkIn, response, metadata)
  );
}

export async function reviewPreSessionCheckInCommand(
  dependencies: Pick<PreSessionDependencies, 'checkIns'>,
  actor: StaffAccessContext,
  checkInId: string,
  metadata: PersistedPreSessionMetadata
): Promise<PreSessionCommandResult> {
  const replayed = await replay(
    dependencies.checkIns,
    actor.organizationId,
    metadata.commandId
  );
  if (replayed) return replayed;

  const checkIn = await dependencies.checkIns.getById(
    actor.organizationId,
    checkInId
  );
  if (!checkIn) throw new Error('Check-in pré-sessão não encontrado.');
  assertStaffAuthorized(actor, 'assessments.read', {
    organizationId: checkIn.organizationId,
    patientId: checkIn.patientId,
    assignedProfessionalIds: [checkIn.professionalId],
  });

  return persist(
    dependencies.checkIns,
    reviewPreSessionCheckIn(checkIn, metadata),
    checkIn.version,
    metadata.commandId
  );
}
