import type {
  AuthenticatedPrincipal,
  IdentityUser,
  Organization,
  OrganizationMembership,
  PatientProfile,
  PatientResponsibleLink,
  ProfessionalProfile,
  ResponsibleParty,
} from './types';

export interface AuthenticationPort {
  verifySessionCredential(
    credential: string
  ): Promise<AuthenticatedPrincipal | null>;
  createInvitation(input: {
    userId: string;
    organizationId: string;
    expiresAt: string;
  }): Promise<{ invitationReference: string }>;
  revokeUserSessions(userId: string): Promise<void>;
}

export interface IdentityRepository {
  getOrganization(id: string): Promise<Organization | null>;
  saveOrganization(organization: Organization): Promise<void>;
  getUser(id: string): Promise<IdentityUser | null>;
  saveUser(user: IdentityUser): Promise<void>;
  getMembership(
    organizationId: string,
    membershipId: string
  ): Promise<OrganizationMembership | null>;
  findMembershipByUser(
    organizationId: string,
    userId: string
  ): Promise<OrganizationMembership | null>;
  listMemberships(
    organizationId: string
  ): Promise<readonly OrganizationMembership[]>;
  saveMembership(membership: OrganizationMembership): Promise<void>;
  getProfessional(
    organizationId: string,
    professionalId: string
  ): Promise<ProfessionalProfile | null>;
  saveProfessional(profile: ProfessionalProfile): Promise<void>;
  getPatient(
    organizationId: string,
    patientId: string
  ): Promise<PatientProfile | null>;
  findPatientByUser(
    organizationId: string,
    userId: string
  ): Promise<PatientProfile | null>;
  listPatients(organizationId: string): Promise<readonly PatientProfile[]>;
  savePatient(patient: PatientProfile): Promise<void>;
  getResponsibleParty(
    organizationId: string,
    responsiblePartyId: string
  ): Promise<ResponsibleParty | null>;
  findResponsiblePartyByUser(
    organizationId: string,
    userId: string
  ): Promise<ResponsibleParty | null>;
  saveResponsibleParty(party: ResponsibleParty): Promise<void>;
  listPatientResponsibleLinks(
    organizationId: string,
    patientId: string
  ): Promise<readonly PatientResponsibleLink[]>;
  savePatientResponsibleLink(link: PatientResponsibleLink): Promise<void>;
}

export interface IdentityAuditEvent {
  id: string;
  organizationId: string;
  actorUserId: string;
  action:
    | 'organization.created'
    | 'membership.invited'
    | 'membership.activated'
    | 'membership.role_changed'
    | 'professional.created'
    | 'patient.created'
    | 'patient.assignment_changed'
    | 'responsible.linked'
    | 'access.denied';
  entityType: string;
  entityId: string;
  occurredAt: string;
  reason?: string;
}

export interface IdentityAuditPort {
  append(event: IdentityAuditEvent): Promise<void>;
}
