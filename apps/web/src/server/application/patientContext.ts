import type { PatientAccessContext } from '@thats-life/core';
import { ApplicationError } from './http';
import { getApplicationStore } from './store';

export interface PatientRequestContext {
  actor: PatientAccessContext;
  idempotencyKey?: string;
  correlationId: string;
}

export async function resolvePatientContext(
  request: Request,
  requireIdempotency = false
): Promise<PatientRequestContext> {
  const organizationId = request.headers.get('x-organization-id');
  const patientIdHeader = request.headers.get('x-patient-id');
  const userIdHeader = request.headers.get('x-user-id');

  const idToFind = patientIdHeader || userIdHeader;

  if (!organizationId || !idToFind) {
    throw new ApplicationError(
      'UNAUTHENTICATED',
      'Contexto de organização (x-organization-id) e paciente (x-patient-id ou x-user-id) é obrigatório.',
      401
    );
  }

  const identities = getApplicationStore().identities;
  let patient = await identities.getPatient(organizationId, idToFind);
  if (!patient && userIdHeader) {
    patient = await identities.findPatientByUser(organizationId, userIdHeader);
  }

  if (!patient || patient.status !== 'active') {
    throw new ApplicationError(
      'FORBIDDEN',
      'Cadastro de paciente ativo não encontrado para os identificadores informados.',
      403
    );
  }

  const idempotencyKey = request.headers.get('idempotency-key') ?? undefined;
  if (requireIdempotency && !idempotencyKey) {
    throw new ApplicationError(
      'IDEMPOTENCY_REQUIRED',
      'O cabeçalho Idempotency-Key é obrigatório.',
      400
    );
  }

  return {
    actor: {
      actorType: 'patient',
      organizationId: patient.organizationId,
      userId: patient.userId ?? `user-${patient.id}`,
      patientId: patient.id,
    },
    idempotencyKey,
    correlationId:
      request.headers.get('x-correlation-id') ?? crypto.randomUUID(),
  };
}
