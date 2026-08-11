import { assertStaffAuthorized } from './authorization';
import {
  createPatientProfile,
  createPatientResponsibleLink,
  createProfessionalProfile,
} from './factories';
import type {
  PatientProfile,
  PatientResponsibleLink,
  ProfessionalProfile,
  StaffAccessContext,
} from './types';
import {
  appendIdentityAudit,
  type IdentityUseCaseDependencies,
} from './useCaseSupport';

export async function registerPatientForOrganization(
  dependencies: IdentityUseCaseDependencies,
  actor: StaffAccessContext,
  input: Omit<PatientProfile, 'status' | 'updatedAt'>
): Promise<PatientProfile> {
  assertStaffAuthorized(actor, 'patients.write', {
    organizationId: input.organizationId,
    patientId: input.id,
    assignedProfessionalIds: input.assignedProfessionalIds,
  });
  for (const professionalId of input.assignedProfessionalIds) {
    const professional = await dependencies.repository.getProfessional(
      input.organizationId,
      professionalId
    );
    if (!professional || professional.status !== 'active') {
      throw new Error(`Profissional ativo não encontrado: ${professionalId}.`);
    }
  }

  const patient = createPatientProfile(input);
  await dependencies.repository.savePatient(patient);
  await appendIdentityAudit(dependencies, {
    id: `audit-${patient.id}`,
    organizationId: patient.organizationId,
    actorUserId: actor.userId,
    action: 'patient.created',
    entityType: 'patient_profile',
    entityId: patient.id,
    occurredAt: patient.createdAt,
  });
  return patient;
}

/**
 * Materializa uma identidade clínica a partir de uma origem externa confiável
 * (por exemplo, um lead confirmado). O id estável da origem é a chave de
 * idempotência: novas tentativas devolvem o mesmo paciente sem sobrescrevê-lo.
 */
export async function ensurePatientFromExternalSource(
  dependencies: IdentityUseCaseDependencies,
  input: Omit<PatientProfile, 'status' | 'updatedAt'>
): Promise<PatientProfile> {
  const existing = await dependencies.repository.getPatient(input.organizationId, input.id);
  if (existing) return existing;

  for (const professionalId of input.assignedProfessionalIds) {
    const professional = await dependencies.repository.getProfessional(input.organizationId, professionalId);
    if (!professional || professional.status !== 'active') {
      throw new Error(`Profissional ativo não encontrado: ${professionalId}.`);
    }
  }

  const patient = createPatientProfile(input);
  await dependencies.repository.savePatient(patient);
  return patient;
}

export async function registerProfessionalForOrganization(
  dependencies: IdentityUseCaseDependencies,
  actor: StaffAccessContext,
  input: Omit<ProfessionalProfile, 'status' | 'updatedAt'>
): Promise<ProfessionalProfile> {
  assertStaffAuthorized(actor, 'members.manage', {
    organizationId: input.organizationId,
  });
  const membership = await dependencies.repository.findMembershipByUser(
    input.organizationId,
    input.userId
  );
  if (!membership) {
    throw new Error('O profissional precisa possuir vínculo com a organização.');
  }
  if (
    !membership.roles.some((role) =>
      ['professional', 'clinical_director'].includes(role)
    )
  ) {
    throw new Error('O vínculo precisa possuir um papel clínico.');
  }
  const professional = createProfessionalProfile(input);
  await dependencies.repository.saveProfessional(professional);
  await dependencies.repository.saveMembership({
    ...membership,
    professionalProfileId: professional.id,
    updatedAt: professional.createdAt,
  });
  await appendIdentityAudit(dependencies, {
    id: `audit-${professional.id}`,
    organizationId: professional.organizationId,
    actorUserId: actor.userId,
    action: 'professional.created',
    entityType: 'professional_profile',
    entityId: professional.id,
    occurredAt: professional.createdAt,
  });
  return professional;
}

export async function linkResponsibleToPatient(
  dependencies: IdentityUseCaseDependencies,
  actor: StaffAccessContext,
  input: PatientResponsibleLink
): Promise<PatientResponsibleLink> {
  const patient = await dependencies.repository.getPatient(
    input.organizationId,
    input.patientId
  );
  if (!patient) throw new Error('Paciente não encontrado na organização.');
  assertStaffAuthorized(actor, 'patients.write', {
    organizationId: input.organizationId,
    patientId: patient.id,
    assignedProfessionalIds: patient.assignedProfessionalIds,
  });
  const responsible = await dependencies.repository.getResponsibleParty(
    input.organizationId,
    input.responsiblePartyId
  );
  if (!responsible || responsible.status !== 'active') {
    throw new Error('Responsável ativo não encontrado na organização.');
  }

  const link = createPatientResponsibleLink(input);
  await dependencies.repository.savePatientResponsibleLink(link);
  await appendIdentityAudit(dependencies, {
    id: `audit-${link.id}`,
    organizationId: link.organizationId,
    actorUserId: actor.userId,
    action: 'responsible.linked',
    entityType: 'patient_responsible_link',
    entityId: link.id,
    occurredAt: link.createdAt,
  });
  return link;
}
