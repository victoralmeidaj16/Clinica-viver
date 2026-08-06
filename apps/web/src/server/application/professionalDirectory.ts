import {
  assertStaffAuthorized,
  createIdentityUser,
  createOrganizationMembership,
  createProfessionalProfile,
  type ProfessionalProfile,
} from '@thats-life/core';
import type { RequestContext } from './context';
import { ApplicationError } from './http';
import { getApplicationStore, persistApplicationState } from './store';

/**
 * Cadastro do corpo clínico.
 *
 * Existe porque o banco de produção não é semeado com profissionais: os dez do
 * `005_seed_profissionais.sql` são fictícios e ficam restritos ao ambiente de
 * desenvolvimento. Sem esta rota, uma instalação nova não teria como registrar
 * quem atende — e sem profissional não há paciente, porque todo paciente nasce
 * atribuído a alguém.
 *
 * Um profissional é três coisas ao mesmo tempo: identidade (`IdentityUser`),
 * perfil clínico (`ProfessionalProfile`) e vínculo com papel (`Membership`).
 * As três são criadas aqui, na ordem em que se referenciam.
 */

export async function listProfessionals(context: RequestContext): Promise<readonly ProfessionalProfile[]> {
  assertStaffAuthorized(context.actor, 'members.read', { organizationId: context.actor.organizationId });

  const store = getApplicationStore();
  const memberships = await store.identities.listMemberships(context.actor.organizationId);

  const profiles = await Promise.all(
    memberships
      .filter((membership) => membership.professionalProfileId && membership.status === 'active')
      .map((membership) =>
        store.identities.getProfessional(context.actor.organizationId, membership.professionalProfileId!)
      )
  );

  return profiles.filter((profile): profile is ProfessionalProfile => profile !== null);
}

export async function createProfessional(
  context: RequestContext,
  body: Record<string, unknown>
): Promise<ProfessionalProfile> {
  assertStaffAuthorized(context.actor, 'members.manage', { organizationId: context.actor.organizationId });

  const displayName = String(body.displayName ?? '').trim();
  if (!displayName) throw new ApplicationError('INVALID_INPUT', 'O nome do profissional é obrigatório.', 400);

  // CRP não é formalidade de cadastro: é o que autoriza a pessoa a assinar
  // prontuário. Sem ele, o perfil não deveria existir.
  const councilRegistration = String(body.councilRegistration ?? '').trim();
  if (!councilRegistration) {
    throw new ApplicationError('INVALID_INPUT', 'O registro no CRP é obrigatório.', 400);
  }

  const store = getApplicationStore();
  const organizationId = context.actor.organizationId;
  const createdAt = String(body.createdAt ?? new Date().toISOString());

  const slug = displayName
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLocaleLowerCase('pt-BR')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');

  const professionalId = String(body.id ?? '').trim() || `professional-${slug}`;
  const userId = String(body.userId ?? '').trim() || `usr-${slug}`;

  const existing = await store.identities.getProfessional(organizationId, professionalId);
  if (existing) return existing;

  await store.identities.saveUser(
    createIdentityUser({
      id: userId,
      displayName,
      normalizedEmail: body.email ? String(body.email).trim().toLocaleLowerCase('pt-BR') : undefined,
      createdAt,
    })
  );

  const professional = createProfessionalProfile({
    id: professionalId,
    organizationId,
    userId,
    displayName,
    councilType: 'CRP',
    councilRegistration,
    specialties: Array.isArray(body.specialties) ? body.specialties.map(String) : [],
    createdAt,
  });
  await store.identities.saveProfessional(professional);

  // Papel `professional` apenas. Administração da clínica é concessão
  // separada — atender não implica gerir membros nem faturamento.
  await store.identities.saveMembership(
    createOrganizationMembership({
      id: `membership-${slug}`,
      organizationId,
      userId,
      roles: ['professional'],
      professionalProfileId: professional.id,
      invitedBy: context.actor.userId,
      createdAt,
    })
  );

  await persistApplicationState();
  return professional;
}
