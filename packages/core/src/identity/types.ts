export type OrganizationStatus = 'active' | 'suspended' | 'archived';
export type OrganizationType = 'solo_practice' | 'clinic';
export type IdentityStatus = 'invited' | 'active' | 'disabled';

export interface Organization {
  id: string;
  type: OrganizationType;
  displayName: string;
  legalName?: string;
  timezone: string;
  status: OrganizationStatus;
  createdAt: string;
  updatedAt: string;
}

export interface IdentityUser {
  id: string;
  displayName: string;
  normalizedEmail?: string;
  status: IdentityStatus;
  createdAt: string;
  updatedAt: string;
}

export type OrganizationRole =
  | 'owner'
  | 'admin'
  | 'clinical_director'
  | 'professional'
  | 'assistant'
  | 'billing'
  | 'auditor';

export type OrganizationPermission =
  | 'organization.read'
  | 'organization.update'
  | 'members.read'
  | 'members.manage'
  | 'patients.read'
  | 'patients.write'
  | 'schedule.read'
  | 'schedule.write'
  | 'clinical_sessions.read'
  | 'clinical_sessions.write'
  | 'clinical_records.read'
  | 'clinical_records.write'
  | 'clinical_records.approve'
  | 'assessments.read'
  | 'assessments.assign'
  | 'billing.read'
  | 'billing.write'
  | 'reports.export'
  | 'audit.read'
  | 'supervision.read'
  | 'supervision.write';

export interface OrganizationMembership {
  id: string;
  organizationId: string;
  userId: string;
  roles: readonly OrganizationRole[];
  status: IdentityStatus;
  professionalProfileId?: string;
  invitedBy?: string;
  createdAt: string;
  updatedAt: string;
}

export interface ProfessionalProfile {
  id: string;
  organizationId: string;
  userId: string;
  displayName: string;
  councilType: 'CRP';
  councilRegistration: string;
  specialties: readonly string[];
  status: 'active' | 'inactive';
  createdAt: string;
  updatedAt: string;
}

export interface PatientProfile {
  id: string;
  organizationId: string;
  userId?: string;
  externalReference?: string;
  displayName: string;
  birthDate?: string;
  status: 'active' | 'paused' | 'discharged';
  primaryProfessionalId?: string;
  assignedProfessionalIds: readonly string[];
  createdAt: string;
  updatedAt: string;
}

export interface ResponsibleParty {
  id: string;
  organizationId: string;
  userId?: string;
  displayName: string;
  relationshipLabel: string;
  status: 'active' | 'inactive';
  createdAt: string;
  updatedAt: string;
}

export interface PatientResponsibleLink {
  id: string;
  organizationId: string;
  patientId: string;
  responsiblePartyId: string;
  authority: 'legal_guardian' | 'financial' | 'caregiver';
  canManageAppointments: boolean;
  canViewBilling: boolean;
  canAccessSharedClinicalContent: boolean;
  canManageTasks: boolean;
  canManageAssessments: boolean;
  activeFrom: string;
  activeUntil?: string;
  createdAt: string;
}

export interface AuthenticatedPrincipal {
  userId: string;
  providerSubject: string;
  authenticatedAt: string;
  expiresAt: string;
  authenticationMethods: readonly string[];
}

export interface StaffAccessContext {
  actorType: 'staff';
  organizationId: string;
  userId: string;
  membershipId: string;
  membershipStatus: IdentityStatus;
  roles: readonly OrganizationRole[];
  professionalProfileId?: string;
}

export interface PatientAccessContext {
  actorType: 'patient';
  organizationId: string;
  userId: string;
  patientId: string;
}

export interface ResponsibleAccessContext {
  actorType: 'responsible';
  organizationId: string;
  userId: string;
  responsiblePartyId: string;
}

export type IdentityAccessContext =
  | StaffAccessContext
  | PatientAccessContext
  | ResponsibleAccessContext;

export interface TenantResource {
  organizationId: string;
  patientId?: string;
  assignedProfessionalIds?: readonly string[];
  ownerUserId?: string;
}

export interface AuthorizationDecision {
  allowed: boolean;
  reason:
    | 'allowed'
    | 'cross_tenant'
    | 'inactive_membership'
    | 'permission_missing'
    | 'patient_scope_mismatch'
    | 'professional_not_assigned';
}

/**
 * Registro de uma troca de profissional responsável por um paciente.
 *
 * Não é derivável do estado atual: `PatientProfile` guarda só quem responde
 * agora. Sem este registro, "por que a paciente trocou de psicóloga em março"
 * é uma pergunta sem resposta no sistema.
 */
export interface PatientReassignment {
  id: string;
  organizationId: string;
  patientId: string;
  /** Ausente quando o paciente ainda não tinha responsável. */
  previousProfessionalId?: string;
  professionalId: string;
  reason: string;
  actorUserId: string;
  occurredAt: string;
}
