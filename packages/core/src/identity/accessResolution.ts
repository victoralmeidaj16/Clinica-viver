import { createStaffAccessContext } from './authorization';
import type { IdentityRepository } from './ports';
import type {
  AuthenticatedPrincipal,
  PatientAccessContext,
  ResponsibleAccessContext,
  StaffAccessContext,
} from './types';

function isPrincipalValid(
  principal: AuthenticatedPrincipal,
  asOf: string
): boolean {
  return (
    Date.parse(principal.authenticatedAt) <= Date.parse(asOf) &&
    Date.parse(principal.expiresAt) > Date.parse(asOf)
  );
}

export async function resolveStaffAccessContext(
  repository: IdentityRepository,
  principal: AuthenticatedPrincipal,
  organizationId: string,
  asOf: string
): Promise<StaffAccessContext | null> {
  if (!isPrincipalValid(principal, asOf)) return null;
  const membership = await repository.findMembershipByUser(
    organizationId,
    principal.userId
  );
  return membership ? createStaffAccessContext(membership) : null;
}

export async function resolvePatientAccessContext(
  repository: IdentityRepository,
  principal: AuthenticatedPrincipal,
  organizationId: string,
  asOf: string
): Promise<PatientAccessContext | null> {
  if (!isPrincipalValid(principal, asOf)) return null;
  const patient = await repository.findPatientByUser(
    organizationId,
    principal.userId
  );
  return patient
    ? {
        actorType: 'patient',
        organizationId,
        userId: principal.userId,
        patientId: patient.id,
      }
    : null;
}

export async function resolveResponsibleAccessContext(
  repository: IdentityRepository,
  principal: AuthenticatedPrincipal,
  organizationId: string,
  asOf: string
): Promise<ResponsibleAccessContext | null> {
  if (!isPrincipalValid(principal, asOf)) return null;
  const responsible = await repository.findResponsiblePartyByUser(
    organizationId,
    principal.userId
  );
  return responsible
    ? {
        actorType: 'responsible',
        organizationId,
        userId: principal.userId,
        responsiblePartyId: responsible.id,
      }
    : null;
}
