import type { IdentityRepository } from './ports';
import type {
  IdentityUser,
  Organization,
  OrganizationMembership,
  PatientProfile,
  PatientResponsibleLink,
  ProfessionalProfile,
  ResponsibleParty,
} from './types';

function clone<T>(value: T): T {
  return structuredClone(value);
}

function upsert<T extends { id: string }>(items: T[], value: T): void {
  const index = items.findIndex(({ id }) => id === value.id);
  if (index >= 0) items[index] = clone(value);
  else items.push(clone(value));
}

export interface IdentitySeed {
  organizations?: readonly Organization[];
  users?: readonly IdentityUser[];
  memberships?: readonly OrganizationMembership[];
  professionals?: readonly ProfessionalProfile[];
  patients?: readonly PatientProfile[];
  responsibleParties?: readonly ResponsibleParty[];
  responsibleLinks?: readonly PatientResponsibleLink[];
}

export class InMemoryIdentityRepository implements IdentityRepository {
  private readonly organizations: Organization[];
  private readonly users: IdentityUser[];
  private readonly memberships: OrganizationMembership[];
  private readonly professionals: ProfessionalProfile[];
  private readonly patients: PatientProfile[];
  private readonly responsibleParties: ResponsibleParty[];
  private readonly responsibleLinks: PatientResponsibleLink[];

  constructor(seed: IdentitySeed = {}) {
    this.organizations = Array.from(seed.organizations ?? [], clone);
    this.users = Array.from(seed.users ?? [], clone);
    this.memberships = Array.from(seed.memberships ?? [], clone);
    this.professionals = Array.from(seed.professionals ?? [], clone);
    this.patients = Array.from(seed.patients ?? [], clone);
    this.responsibleParties = Array.from(seed.responsibleParties ?? [], clone);
    this.responsibleLinks = Array.from(seed.responsibleLinks ?? [], clone);
  }

  async getOrganization(id: string): Promise<Organization | null> {
    const value = this.organizations.find((item) => item.id === id);
    return value ? clone(value) : null;
  }

  async saveOrganization(value: Organization): Promise<void> {
    upsert(this.organizations, value);
  }

  async getUser(id: string): Promise<IdentityUser | null> {
    const value = this.users.find((item) => item.id === id);
    return value ? clone(value) : null;
  }

  async saveUser(value: IdentityUser): Promise<void> {
    upsert(this.users, value);
  }

  async getMembership(
    organizationId: string,
    membershipId: string
  ): Promise<OrganizationMembership | null> {
    const value = this.memberships.find(
      (item) => item.organizationId === organizationId && item.id === membershipId
    );
    return value ? clone(value) : null;
  }

  async findMembershipByUser(
    organizationId: string,
    userId: string
  ): Promise<OrganizationMembership | null> {
    const value = this.memberships.find(
      (item) =>
        item.organizationId === organizationId && item.userId === userId
    );
    return value ? clone(value) : null;
  }

  async listMemberships(
    organizationId: string
  ): Promise<readonly OrganizationMembership[]> {
    return clone(
      this.memberships.filter((item) => item.organizationId === organizationId)
    );
  }

  async saveMembership(value: OrganizationMembership): Promise<void> {
    upsert(this.memberships, value);
  }

  async getProfessional(
    organizationId: string,
    professionalId: string
  ): Promise<ProfessionalProfile | null> {
    const value = this.professionals.find(
      (item) =>
        item.organizationId === organizationId && item.id === professionalId
    );
    return value ? clone(value) : null;
  }

  async saveProfessional(value: ProfessionalProfile): Promise<void> {
    upsert(this.professionals, value);
  }

  async getPatient(
    organizationId: string,
    patientId: string
  ): Promise<PatientProfile | null> {
    const value = this.patients.find(
      (item) => item.organizationId === organizationId && item.id === patientId
    );
    return value ? clone(value) : null;
  }

  async findPatientByUser(
    organizationId: string,
    userId: string
  ): Promise<PatientProfile | null> {
    const value = this.patients.find(
      (item) =>
        item.organizationId === organizationId && item.userId === userId
    );
    return value ? clone(value) : null;
  }

  async listPatients(
    organizationId: string
  ): Promise<readonly PatientProfile[]> {
    return clone(
      this.patients.filter((item) => item.organizationId === organizationId)
    );
  }

  async savePatient(value: PatientProfile): Promise<void> {
    upsert(this.patients, value);
  }

  async reassignPatient(input: {
    organizationId: string;
    patientId: string;
    professionalId: string;
    actorUserId: string;
    reason: string;
    changedAt: string;
  }): Promise<PatientProfile | null> {
    const index = this.patients.findIndex(
      (patient) => patient.organizationId === input.organizationId && patient.id === input.patientId
    );
    if (index < 0) return null;

    const current = this.patients[index];
    if (current.primaryProfessionalId === input.professionalId) return clone(current);
    const next: PatientProfile = {
      ...current,
      primaryProfessionalId: input.professionalId,
      assignedProfessionalIds: [input.professionalId],
      updatedAt: input.changedAt,
    };
    this.patients[index] = clone(next);
    return clone(next);
  }

  async getResponsibleParty(
    organizationId: string,
    responsiblePartyId: string
  ): Promise<ResponsibleParty | null> {
    const value = this.responsibleParties.find(
      (item) =>
        item.organizationId === organizationId && item.id === responsiblePartyId
    );
    return value ? clone(value) : null;
  }

  async findResponsiblePartyByUser(
    organizationId: string,
    userId: string
  ): Promise<ResponsibleParty | null> {
    const value = this.responsibleParties.find(
      (item) =>
        item.organizationId === organizationId && item.userId === userId
    );
    return value ? clone(value) : null;
  }

  async saveResponsibleParty(value: ResponsibleParty): Promise<void> {
    upsert(this.responsibleParties, value);
  }

  async listPatientResponsibleLinks(
    organizationId: string,
    patientId: string
  ): Promise<readonly PatientResponsibleLink[]> {
    return clone(
      this.responsibleLinks.filter(
        (item) =>
          item.organizationId === organizationId && item.patientId === patientId
      )
    );
  }

  async savePatientResponsibleLink(
    value: PatientResponsibleLink
  ): Promise<void> {
    upsert(this.responsibleLinks, value);
  }
}
