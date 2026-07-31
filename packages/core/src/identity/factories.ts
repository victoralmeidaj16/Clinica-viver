import type {
  IdentityUser,
  Organization,
  OrganizationMembership,
  PatientProfile,
  PatientResponsibleLink,
  ProfessionalProfile,
  ResponsibleParty,
} from './types';

function required(value: string, field: string): string {
  const normalized = value.replace(/\s+/g, ' ').trim();
  if (!normalized) throw new Error(`${field} é obrigatório.`);
  return normalized;
}

function isoDate(value: string, field: string): string {
  if (Number.isNaN(Date.parse(value))) {
    throw new Error(`${field} deve ser uma data ISO válida.`);
  }
  return value;
}

export function createOrganization(
  input: Omit<Organization, 'status' | 'updatedAt'>
): Organization {
  return {
    ...input,
    id: required(input.id, 'id'),
    displayName: required(input.displayName, 'displayName'),
    legalName: input.legalName
      ? required(input.legalName, 'legalName')
      : undefined,
    timezone: required(input.timezone, 'timezone'),
    status: 'active',
    createdAt: isoDate(input.createdAt, 'createdAt'),
    updatedAt: input.createdAt,
  };
}

export function createIdentityUser(
  input: Omit<IdentityUser, 'status' | 'updatedAt'>
): IdentityUser {
  return {
    ...input,
    id: required(input.id, 'id'),
    displayName: required(input.displayName, 'displayName'),
    normalizedEmail: input.normalizedEmail
      ? required(input.normalizedEmail, 'normalizedEmail').toLocaleLowerCase(
          'en-US'
        )
      : undefined,
    status: 'invited',
    createdAt: isoDate(input.createdAt, 'createdAt'),
    updatedAt: input.createdAt,
  };
}

export function createOrganizationMembership(
  input: Omit<OrganizationMembership, 'status' | 'updatedAt'>
): OrganizationMembership {
  const roles = Array.from(new Set(input.roles));
  if (roles.length === 0) {
    throw new Error('O vínculo precisa possuir ao menos um papel.');
  }
  return {
    ...input,
    id: required(input.id, 'id'),
    organizationId: required(input.organizationId, 'organizationId'),
    userId: required(input.userId, 'userId'),
    roles,
    status: 'invited',
    createdAt: isoDate(input.createdAt, 'createdAt'),
    updatedAt: input.createdAt,
  };
}

export function activateOrganizationMembership(
  membership: OrganizationMembership,
  activatedAt: string
): OrganizationMembership {
  if (membership.status !== 'invited') {
    throw new Error('Somente um vínculo convidado pode ser ativado.');
  }
  return {
    ...membership,
    status: 'active',
    updatedAt: isoDate(activatedAt, 'activatedAt'),
  };
}

export function createProfessionalProfile(
  input: Omit<ProfessionalProfile, 'status' | 'updatedAt'>
): ProfessionalProfile {
  return {
    ...input,
    id: required(input.id, 'id'),
    organizationId: required(input.organizationId, 'organizationId'),
    userId: required(input.userId, 'userId'),
    displayName: required(input.displayName, 'displayName'),
    councilRegistration: required(
      input.councilRegistration,
      'councilRegistration'
    ),
    specialties: Array.from(
      new Set(input.specialties.map((item) => required(item, 'specialty')))
    ),
    status: 'active',
    createdAt: isoDate(input.createdAt, 'createdAt'),
    updatedAt: input.createdAt,
  };
}

export function createPatientProfile(
  input: Omit<PatientProfile, 'status' | 'updatedAt'>
): PatientProfile {
  const assignedProfessionalIds = Array.from(
    new Set(input.assignedProfessionalIds.map((id) => required(id, 'professionalId')))
  );
  if (
    input.primaryProfessionalId &&
    !assignedProfessionalIds.includes(input.primaryProfessionalId)
  ) {
    throw new Error('O profissional principal deve estar atribuído ao paciente.');
  }

  return {
    ...input,
    id: required(input.id, 'id'),
    organizationId: required(input.organizationId, 'organizationId'),
    displayName: required(input.displayName, 'displayName'),
    assignedProfessionalIds,
    status: 'active',
    createdAt: isoDate(input.createdAt, 'createdAt'),
    updatedAt: input.createdAt,
  };
}

export function createResponsibleParty(
  input: Omit<ResponsibleParty, 'status' | 'updatedAt'>
): ResponsibleParty {
  return {
    ...input,
    id: required(input.id, 'id'),
    organizationId: required(input.organizationId, 'organizationId'),
    displayName: required(input.displayName, 'displayName'),
    relationshipLabel: required(input.relationshipLabel, 'relationshipLabel'),
    status: 'active',
    createdAt: isoDate(input.createdAt, 'createdAt'),
    updatedAt: input.createdAt,
  };
}

export function createPatientResponsibleLink(
  input: PatientResponsibleLink
): PatientResponsibleLink {
  isoDate(input.activeFrom, 'activeFrom');
  isoDate(input.createdAt, 'createdAt');
  if (input.activeUntil) {
    isoDate(input.activeUntil, 'activeUntil');
    if (Date.parse(input.activeUntil) < Date.parse(input.activeFrom)) {
      throw new Error('activeUntil não pode ser anterior a activeFrom.');
    }
  }
  return {
    ...input,
    id: required(input.id, 'id'),
    organizationId: required(input.organizationId, 'organizationId'),
    patientId: required(input.patientId, 'patientId'),
    responsiblePartyId: required(
      input.responsiblePartyId,
      'responsiblePartyId'
    ),
  };
}
