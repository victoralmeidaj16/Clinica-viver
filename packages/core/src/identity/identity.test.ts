import { describe, expect, it } from 'vitest';
import {
  authorizePatientSelf,
  authorizeResponsible,
  authorizeStaff,
  createStaffAccessContext,
} from './authorization';
import {
  createIdentityUser,
  createOrganization,
  createPatientProfile,
} from './factories';
import { InMemoryIdentityRepository } from './inMemoryRepository';
import type {
  AuthenticatedPrincipal,
  OrganizationMembership,
  PatientResponsibleLink,
  ProfessionalProfile,
  ResponsibleParty,
  StaffAccessContext,
} from './types';
import {
  changeOrganizationMemberRoles,
  inviteOrganizationMember,
  linkResponsibleToPatient,
  ensurePatientFromExternalSource,
  registerPatientForOrganization,
  resolvePatientAccessContext,
  resolveResponsibleAccessContext,
  resolveStaffAccessContext,
} from './index';

const now = '2026-07-30T12:00:00.000Z';
const organization = createOrganization({
  id: 'org-1',
  type: 'clinic',
  displayName: 'Clínica Horizonte',
  timezone: 'America/Sao_Paulo',
  createdAt: now,
});
const otherOrganization = createOrganization({
  id: 'org-2',
  type: 'solo_practice',
  displayName: 'Consultório Aurora',
  timezone: 'America/Sao_Paulo',
  createdAt: now,
});
const ownerMembership: OrganizationMembership = {
  id: 'membership-owner',
  organizationId: organization.id,
  userId: 'user-owner',
  roles: ['owner'],
  status: 'active',
  createdAt: now,
  updatedAt: now,
};
const professionalProfile: ProfessionalProfile = {
  id: 'professional-1',
  organizationId: organization.id,
  userId: 'user-professional',
  displayName: 'Dra. Camila',
  councilType: 'CRP',
  councilRegistration: '06/148293',
  specialties: ['TCC'],
  status: 'active',
  createdAt: now,
  updatedAt: now,
};
const professionalMembership: OrganizationMembership = {
  id: 'membership-professional',
  organizationId: organization.id,
  userId: professionalProfile.userId,
  roles: ['professional'],
  status: 'active',
  professionalProfileId: professionalProfile.id,
  createdAt: now,
  updatedAt: now,
};
const responsibleParty: ResponsibleParty = {
  id: 'responsible-1',
  organizationId: organization.id,
  userId: 'user-responsible',
  displayName: 'Responsável fictício',
  relationshipLabel: 'Responsável legal',
  status: 'active',
  createdAt: now,
  updatedAt: now,
};

function createRepository() {
  return new InMemoryIdentityRepository({
    organizations: [organization, otherOrganization],
    memberships: [ownerMembership, professionalMembership],
    professionals: [professionalProfile],
    responsibleParties: [responsibleParty],
  });
}

describe('identity and multi-tenancy', () => {
  it('normaliza identidade sem armazenar credenciais do provedor', () => {
    const user = createIdentityUser({
      id: 'user-1',
      displayName: '  Pessoa   Fictícia ',
      normalizedEmail: 'PESSOA@EXAMPLE.COM',
      createdAt: now,
    });

    expect(user.displayName).toBe('Pessoa Fictícia');
    expect(user.normalizedEmail).toBe('pessoa@example.com');
    expect(user.status).toBe('invited');
    expect(user).not.toHaveProperty('password');
    expect(user).not.toHaveProperty('accessToken');
  });

  it('aplica papéis e bloqueia acesso entre organizações antes do RBAC', () => {
    const owner = createStaffAccessContext(ownerMembership);
    const crossTenant = authorizeStaff(owner, 'members.manage', {
      organizationId: otherOrganization.id,
    });
    const allowed = authorizeStaff(owner, 'members.manage', {
      organizationId: organization.id,
    });

    expect(allowed).toEqual({ allowed: true, reason: 'allowed' });
    expect(crossTenant).toEqual({ allowed: false, reason: 'cross_tenant' });
    expect(
      authorizeStaff(owner, 'clinical_records.read', {
        organizationId: organization.id,
        patientId: 'patient-1',
        assignedProfessionalIds: [professionalProfile.id],
      }).reason
    ).toBe('permission_missing');
  });

  it('limita o profissional aos pacientes atribuídos', () => {
    const professional = createStaffAccessContext(professionalMembership);
    expect(
      authorizeStaff(professional, 'clinical_records.read', {
        organizationId: organization.id,
        patientId: 'patient-1',
        assignedProfessionalIds: [professionalProfile.id],
      }).allowed
    ).toBe(true);
    expect(
      authorizeStaff(professional, 'clinical_records.read', {
        organizationId: organization.id,
        patientId: 'patient-2',
        assignedProfessionalIds: ['professional-2'],
      })
    ).toEqual({ allowed: false, reason: 'professional_not_assigned' });
    expect(
      authorizeStaff(professional, 'billing.write', {
        organizationId: organization.id,
      }).reason
    ).toBe('permission_missing');
  });

  it('separa acesso próprio do paciente e permissões do responsável', () => {
    const patientResource = {
      organizationId: organization.id,
      patientId: 'patient-1',
    };
    expect(
      authorizePatientSelf(
        {
          actorType: 'patient',
          organizationId: organization.id,
          userId: 'user-patient',
          patientId: 'patient-1',
        },
        patientResource
      ).allowed
    ).toBe(true);

    const responsibleLink: PatientResponsibleLink = {
      id: 'link-1',
      organizationId: organization.id,
      patientId: 'patient-1',
      responsiblePartyId: responsibleParty.id,
      authority: 'legal_guardian',
      canManageAppointments: true,
      canViewBilling: true,
      canAccessSharedClinicalContent: false,
      canManageTasks: false,
      canManageAssessments: true,
      activeFrom: '2026-01-01T00:00:00.000Z',
      createdAt: now,
    };
    const context = {
      actorType: 'responsible' as const,
      organizationId: organization.id,
      userId: responsibleParty.userId!,
      responsiblePartyId: responsibleParty.id,
    };

    expect(
      authorizeResponsible(
        context,
        responsibleLink,
        'appointments.write',
        patientResource,
        now
      ).allowed
    ).toBe(true);
    expect(
      authorizeResponsible(
        context,
        responsibleLink,
        'shared_clinical_content.read',
        patientResource,
        now
      ).reason
    ).toBe('permission_missing');
  });

  it('convida membros somente com permissão administrativa', async () => {
    const repository = createRepository();
    const input = {
      id: 'membership-billing',
      organizationId: organization.id,
      userId: 'user-billing',
      roles: ['billing'] as const,
      createdAt: now,
      invitedBy: ownerMembership.userId,
    };
    const invited = await inviteOrganizationMember(
      { repository },
      createStaffAccessContext(ownerMembership),
      input
    );

    expect(invited.status).toBe('invited');
    await expect(
      inviteOrganizationMember(
        { repository },
        createStaffAccessContext(professionalMembership),
        { ...input, id: 'membership-other', userId: 'user-other' }
      )
    ).rejects.toThrow('permission_missing');

    const admin: StaffAccessContext = {
      actorType: 'staff',
      organizationId: organization.id,
      userId: 'user-admin',
      membershipId: 'membership-admin',
      membershipStatus: 'active',
      roles: ['admin'],
    };
    await expect(
      inviteOrganizationMember(
        { repository },
        admin,
        {
          ...input,
          id: 'membership-owner-2',
          userId: 'user-owner-2',
          roles: ['owner'],
        }
      )
    ).rejects.toThrow('Somente um proprietário');
  });

  it('registra paciente somente com profissionais ativos da mesma clínica', async () => {
    const repository = createRepository();
    const actor = createStaffAccessContext(professionalMembership);
    const patient = await registerPatientForOrganization(
      { repository },
      actor,
      {
        id: 'patient-1',
        organizationId: organization.id,
        displayName: 'Paciente fictício',
        primaryProfessionalId: professionalProfile.id,
        assignedProfessionalIds: [professionalProfile.id],
        createdAt: now,
      }
    );

    expect(patient.status).toBe('active');
    expect(
      await repository.getPatient(organization.id, patient.id)
    ).toMatchObject({ id: patient.id });
    expect(
      await repository.getPatient(otherOrganization.id, patient.id)
    ).toBeNull();
  });

  it('reatribui paciente sem manter acesso do profissional anterior', async () => {
    const secondProfessional: ProfessionalProfile = {
      ...professionalProfile,
      id: 'professional-2',
      userId: 'user-professional-2',
      displayName: 'Dra. Marina',
    };
    const repository = new InMemoryIdentityRepository({
      organizations: [organization],
      professionals: [professionalProfile, secondProfessional],
      patients: [createPatientProfile({
        id: 'patient-reassignment',
        organizationId: organization.id,
        displayName: 'Paciente fictício',
        primaryProfessionalId: professionalProfile.id,
        assignedProfessionalIds: [professionalProfile.id],
        createdAt: now,
      })],
    });

    const changedAt = '2026-07-30T13:00:00.000Z';
    const reassigned = await repository.reassignPatient({
      organizationId: organization.id,
      patientId: 'patient-reassignment',
      professionalId: secondProfessional.id,
      actorUserId: ownerMembership.userId,
      reason: 'Adequação de abordagem',
      changedAt,
    });

    expect(reassigned).toMatchObject({
      primaryProfessionalId: secondProfessional.id,
      assignedProfessionalIds: [secondProfessional.id],
      updatedAt: changedAt,
    });
    expect(
      await repository.reassignPatient({
        organizationId: otherOrganization.id,
        patientId: 'patient-reassignment',
        professionalId: secondProfessional.id,
        actorUserId: ownerMembership.userId,
        reason: 'Tentativa entre organizações',
        changedAt,
      })
    ).toBeNull();
  });

  it('promove uma origem externa de forma idempotente e preserva o mapeamento', async () => {
    const repository = createRepository();
    const input = {
      id: 'paciente-lead-42',
      organizationId: organization.id,
      externalReference: 'VM-2026-0042',
      displayName: 'Paciente de integração',
      primaryProfessionalId: professionalProfile.id,
      assignedProfessionalIds: [professionalProfile.id],
      createdAt: now,
    };

    const first = await ensurePatientFromExternalSource({ repository }, input);
    const replay = await ensurePatientFromExternalSource(
      { repository },
      { ...input, displayName: 'Nome que não deve sobrescrever' }
    );

    expect(replay).toEqual(first);
    expect(first).toMatchObject({
      id: 'paciente-lead-42',
      externalReference: 'VM-2026-0042',
      displayName: 'Paciente de integração',
      primaryProfessionalId: professionalProfile.id,
      assignedProfessionalIds: [professionalProfile.id],
    });
    expect(await repository.listPatients(organization.id)).toHaveLength(1);
  });

  it('exige paciente e responsável no mesmo tenant para criar vínculo', async () => {
    const repository = createRepository();
    const actor = createStaffAccessContext(ownerMembership);
    const patient = createPatientProfile({
      id: 'patient-1',
      organizationId: organization.id,
      displayName: 'Paciente fictício',
      assignedProfessionalIds: [professionalProfile.id],
      createdAt: now,
    });
    await repository.savePatient(patient);

    const link = await linkResponsibleToPatient(
      { repository },
      actor,
      {
        id: 'link-1',
        organizationId: organization.id,
        patientId: patient.id,
        responsiblePartyId: responsibleParty.id,
        authority: 'financial',
        canManageAppointments: false,
        canViewBilling: true,
        canAccessSharedClinicalContent: false,
        canManageTasks: false,
        canManageAssessments: false,
        activeFrom: now,
        createdAt: now,
      }
    );

    expect(link.canViewBilling).toBe(true);
    expect(link.canAccessSharedClinicalContent).toBe(false);
  });

  it('preserva ao menos um proprietário ativo e resolve sessão autenticada', async () => {
    const repository = createRepository();
    const owner = createStaffAccessContext(ownerMembership);
    await expect(
      changeOrganizationMemberRoles(
        { repository },
        owner,
        ownerMembership.id,
        ['admin'],
        '2026-07-30T12:10:00.000Z'
      )
    ).rejects.toThrow('ao menos um proprietário ativo');

    const principal: AuthenticatedPrincipal = {
      userId: professionalMembership.userId,
      providerSubject: 'provider-subject',
      authenticatedAt: '2026-07-30T11:00:00.000Z',
      expiresAt: '2026-07-30T13:00:00.000Z',
      authenticationMethods: ['passkey'],
    };
    const context = await resolveStaffAccessContext(
      repository,
      principal,
      organization.id,
      now
    );
    expect(context).toMatchObject({
      roles: ['professional'],
      organizationId: organization.id,
    } satisfies Partial<StaffAccessContext>);
  });

  it('resolve pacientes e responsáveis somente pelo usuário autenticado vinculado', async () => {
    const repository = createRepository();
    await repository.savePatient(
      createPatientProfile({
        id: 'patient-portal',
        organizationId: organization.id,
        userId: 'user-patient',
        displayName: 'Paciente do portal',
        assignedProfessionalIds: [professionalProfile.id],
        createdAt: now,
      })
    );
    const patientPrincipal: AuthenticatedPrincipal = {
      userId: 'user-patient',
      providerSubject: 'patient-subject',
      authenticatedAt: '2026-07-30T11:00:00.000Z',
      expiresAt: '2026-07-30T13:00:00.000Z',
      authenticationMethods: ['otp'],
    };
    const responsiblePrincipal: AuthenticatedPrincipal = {
      ...patientPrincipal,
      userId: responsibleParty.userId!,
      providerSubject: 'responsible-subject',
    };

    expect(
      await resolvePatientAccessContext(
        repository,
        patientPrincipal,
        organization.id,
        now
      )
    ).toMatchObject({ actorType: 'patient', patientId: 'patient-portal' });
    expect(
      await resolveResponsibleAccessContext(
        repository,
        responsiblePrincipal,
        organization.id,
        now
      )
    ).toMatchObject({
      actorType: 'responsible',
      responsiblePartyId: responsibleParty.id,
    });
    expect(
      await resolvePatientAccessContext(
        repository,
        responsiblePrincipal,
        organization.id,
        now
      )
    ).toBeNull();
  });
});
