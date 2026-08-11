import type {
  AuthenticatedPrincipal,
  IdentityUser,
  Organization,
  OrganizationMembership,
  PatientProfile,
  PatientReassignment,
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
  reassignPatient(input: {
    organizationId: string;
    patientId: string;
    professionalId: string;
    actorUserId: string;
    reason: string;
    changedAt: string;
  }): Promise<PatientProfile | null>;
  /**
   * Histórico de trocas de profissional responsável, da mais recente para a
   * mais antiga.
   *
   * Existe porque `reassignPatient` recebe `reason` e `actorUserId` e, até
   * agora, os dois se perdiam: o adaptador em memória descartava, e o MySQL
   * concatenava uma linha de texto num campo de observação truncado que nada
   * lia de volta. Trocar o psicólogo de um paciente é decisão que precisa ter
   * autor e justificativa recuperáveis.
   */
  listPatientReassignments(
    organizationId: string,
    patientId: string
  ): Promise<readonly PatientReassignment[]>;
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
