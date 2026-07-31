import type {
  AuthorizationDecision,
  OrganizationMembership,
  OrganizationPermission,
  OrganizationRole,
  PatientAccessContext,
  PatientResponsibleLink,
  ResponsibleAccessContext,
  StaffAccessContext,
  TenantResource,
} from './types';

export type PortalPermission =
  | 'appointments.read'
  | 'appointments.write'
  | 'shared_clinical_content.read'
  | 'tasks.read'
  | 'tasks.write'
  | 'billing.read'
  | 'assessments.complete';

const ROLE_PERMISSIONS: Readonly<
  Record<OrganizationRole, readonly OrganizationPermission[]>
> = {
  owner: [
    'organization.read',
    'organization.update',
    'members.read',
    'members.manage',
    'patients.read',
    'patients.write',
    'schedule.read',
    'schedule.write',
    'billing.read',
    'billing.write',
    'reports.export',
    'audit.read',
  ],
  admin: [
    'organization.read',
    'organization.update',
    'members.read',
    'members.manage',
    'patients.read',
    'patients.write',
    'schedule.read',
    'schedule.write',
    'billing.read',
    'billing.write',
    'reports.export',
    'audit.read',
  ],
  clinical_director: [
    'organization.read',
    'members.read',
    'patients.read',
    'patients.write',
    'schedule.read',
    'schedule.write',
    'clinical_sessions.read',
    'clinical_sessions.write',
    'clinical_records.read',
    'clinical_records.write',
    'clinical_records.approve',
    'assessments.read',
    'assessments.assign',
    'reports.export',
    'supervision.read',
    'supervision.write',
  ],
  professional: [
    'organization.read',
    'patients.read',
    'patients.write',
    'schedule.read',
    'schedule.write',
    'clinical_sessions.read',
    'clinical_sessions.write',
    'clinical_records.read',
    'clinical_records.write',
    'clinical_records.approve',
    'assessments.read',
    'assessments.assign',
    'supervision.read',
  ],
  assistant: [
    'organization.read',
    'patients.read',
    'patients.write',
    'schedule.read',
    'schedule.write',
    'billing.read',
  ],
  billing: [
    'organization.read',
    'patients.read',
    'billing.read',
    'billing.write',
    'reports.export',
  ],
  auditor: [
    'organization.read',
    'members.read',
    'billing.read',
    'reports.export',
    'audit.read',
  ],
};

export function getRolePermissions(
  role: OrganizationRole
): readonly OrganizationPermission[] {
  return ROLE_PERMISSIONS[role];
}

export function authorizeStaff(
  context: StaffAccessContext,
  permission: OrganizationPermission,
  resource: TenantResource
): AuthorizationDecision {
  if (context.organizationId !== resource.organizationId) {
    return { allowed: false, reason: 'cross_tenant' };
  }
  if (context.membershipStatus !== 'active') {
    return { allowed: false, reason: 'inactive_membership' };
  }
  const grantingRoles = context.roles.filter((role) =>
    ROLE_PERMISSIONS[role].includes(permission)
  );
  if (grantingRoles.length === 0) {
    return { allowed: false, reason: 'permission_missing' };
  }
  if (
    grantingRoles.every((role) => role === 'professional') &&
    resource.patientId &&
    (!context.professionalProfileId ||
      !resource.assignedProfessionalIds?.includes(context.professionalProfileId))
  ) {
    return { allowed: false, reason: 'professional_not_assigned' };
  }
  return { allowed: true, reason: 'allowed' };
}

export function assertStaffAuthorized(
  context: StaffAccessContext,
  permission: OrganizationPermission,
  resource: TenantResource
): void {
  const decision = authorizeStaff(context, permission, resource);
  if (!decision.allowed) {
    throw new Error(`Acesso negado: ${decision.reason}.`);
  }
}

export function authorizePatientSelf(
  context: PatientAccessContext,
  resource: TenantResource
): AuthorizationDecision {
  if (context.organizationId !== resource.organizationId) {
    return { allowed: false, reason: 'cross_tenant' };
  }
  if (!resource.patientId || context.patientId !== resource.patientId) {
    return { allowed: false, reason: 'patient_scope_mismatch' };
  }
  return { allowed: true, reason: 'allowed' };
}

export function authorizeResponsible(
  context: ResponsibleAccessContext,
  link: PatientResponsibleLink,
  permission: PortalPermission,
  resource: TenantResource,
  asOf: string
): AuthorizationDecision {
  if (
    context.organizationId !== resource.organizationId ||
    link.organizationId !== resource.organizationId
  ) {
    return { allowed: false, reason: 'cross_tenant' };
  }
  if (
    context.responsiblePartyId !== link.responsiblePartyId ||
    resource.patientId !== link.patientId
  ) {
    return { allowed: false, reason: 'patient_scope_mismatch' };
  }
  const isActive =
    Date.parse(link.activeFrom) <= Date.parse(asOf) &&
    (!link.activeUntil || Date.parse(link.activeUntil) >= Date.parse(asOf));
  if (!isActive) return { allowed: false, reason: 'inactive_membership' };

  const allowed =
    permission === 'appointments.read' ||
    (permission === 'appointments.write' && link.canManageAppointments) ||
    (permission === 'billing.read' && link.canViewBilling) ||
    (permission === 'shared_clinical_content.read' &&
      link.canAccessSharedClinicalContent) ||
    (permission === 'tasks.read' && link.canAccessSharedClinicalContent) ||
    (permission === 'tasks.write' && link.canManageTasks) ||
    (permission === 'assessments.complete' && link.canManageAssessments);

  return allowed
    ? { allowed: true, reason: 'allowed' }
    : { allowed: false, reason: 'permission_missing' };
}

export function createStaffAccessContext(
  membership: OrganizationMembership
): StaffAccessContext {
  return {
    actorType: 'staff',
    organizationId: membership.organizationId,
    userId: membership.userId,
    membershipId: membership.id,
    membershipStatus: membership.status,
    roles: membership.roles,
    professionalProfileId: membership.professionalProfileId,
  };
}
