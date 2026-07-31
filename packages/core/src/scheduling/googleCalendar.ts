import { assertStaffAuthorized, type StaffAccessContext } from '../identity';
import type { ExternalCalendarConnectionRepository, ExternalCalendarProviderPort } from './ports';
import type { ExternalCalendarConnection } from './types';
import { requireSchedulingIsoDate, requireSchedulingText } from './validation';

export interface GoogleCalendarConnectionDependencies {
  connections: ExternalCalendarConnectionRepository;
  provider: ExternalCalendarProviderPort;
}

export interface BeginGoogleCalendarConnectionInput {
  connectionId: string;
  professionalId: string;
  redirectUri: string;
  occurredAt: string;
}

export async function beginGoogleCalendarConnection(
  dependencies: GoogleCalendarConnectionDependencies,
  actor: StaffAccessContext,
  input: BeginGoogleCalendarConnectionInput
): Promise<{ connection: ExternalCalendarConnection; authorizationUrl: string }> {
  if (actor.professionalProfileId !== input.professionalId) {
    throw new Error('O usuário não representa o profissional que conectará a agenda.');
  }
  assertStaffAuthorized(actor, 'schedule.write', { organizationId: actor.organizationId });
  const occurredAt = requireSchedulingIsoDate(input.occurredAt, 'occurredAt');
  const existing = await dependencies.connections.getByProfessional(
    actor.organizationId,
    input.professionalId
  );
  const connection: ExternalCalendarConnection = {
    id: existing?.id ?? requireSchedulingText(input.connectionId, 'connectionId'),
    organizationId: actor.organizationId,
    professionalId: input.professionalId,
    provider: 'google_calendar',
    status: 'pending',
    createdAt: existing?.createdAt ?? occurredAt,
    updatedAt: occurredAt,
  };
  const authorization = await dependencies.provider.beginAuthorization({
    organizationId: actor.organizationId,
    professionalId: input.professionalId,
    provider: 'google_calendar',
    redirectUri: requireSchedulingText(input.redirectUri, 'redirectUri'),
  });
  await dependencies.connections.save(connection);
  return { connection, authorizationUrl: authorization.authorizationUrl };
}

export async function completeGoogleCalendarConnection(
  dependencies: GoogleCalendarConnectionDependencies,
  input: {
    organizationId: string;
    professionalId: string;
    code: string;
    stateReference: string;
    occurredAt: string;
  }
): Promise<ExternalCalendarConnection> {
  const current = await dependencies.connections.getByProfessional(
    input.organizationId,
    input.professionalId
  );
  if (!current || current.status !== 'pending') {
    throw new Error('Não há conexão Google Calendar pendente para concluir.');
  }
  const authorization = await dependencies.provider.completeAuthorization({
    organizationId: input.organizationId,
    professionalId: input.professionalId,
    provider: 'google_calendar',
    code: requireSchedulingText(input.code, 'code'),
    stateReference: requireSchedulingText(input.stateReference, 'stateReference'),
  });
  const connection: ExternalCalendarConnection = {
    ...current,
    status: 'connected',
    calendarId: authorization.calendarId,
    providerAccountReference: authorization.providerAccountReference,
    errorCode: undefined,
    updatedAt: requireSchedulingIsoDate(input.occurredAt, 'occurredAt'),
  };
  await dependencies.connections.save(connection);
  return connection;
}
