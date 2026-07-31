import { assertStaffAuthorized } from './authorization';
import { createOrganizationMembership } from './factories';
import type { OrganizationMembership, StaffAccessContext } from './types';
import {
  appendIdentityAudit,
  type IdentityUseCaseDependencies,
} from './useCaseSupport';

export async function inviteOrganizationMember(
  dependencies: IdentityUseCaseDependencies,
  actor: StaffAccessContext,
  input: Omit<OrganizationMembership, 'status' | 'updatedAt'>
): Promise<OrganizationMembership> {
  assertStaffAuthorized(actor, 'members.manage', {
    organizationId: input.organizationId,
  });
  if (input.roles.includes('owner') && !actor.roles.includes('owner')) {
    throw new Error('Somente um proprietário pode convidar outro proprietário.');
  }
  const organization = await dependencies.repository.getOrganization(
    input.organizationId
  );
  if (!organization || organization.status !== 'active') {
    throw new Error('Organização ativa não encontrada.');
  }
  const existing = await dependencies.repository.findMembershipByUser(
    input.organizationId,
    input.userId
  );
  if (existing) throw new Error('Usuário já possui vínculo com a organização.');

  const membership = createOrganizationMembership(input);
  await dependencies.repository.saveMembership(membership);
  await appendIdentityAudit(dependencies, {
    id: `audit-${membership.id}`,
    organizationId: membership.organizationId,
    actorUserId: actor.userId,
    action: 'membership.invited',
    entityType: 'organization_membership',
    entityId: membership.id,
    occurredAt: membership.createdAt,
  });
  return membership;
}

export async function changeOrganizationMemberRoles(
  dependencies: IdentityUseCaseDependencies,
  actor: StaffAccessContext,
  membershipId: string,
  roles: OrganizationMembership['roles'],
  changedAt: string
): Promise<OrganizationMembership> {
  assertStaffAuthorized(actor, 'members.manage', {
    organizationId: actor.organizationId,
  });
  const membership = await dependencies.repository.getMembership(
    actor.organizationId,
    membershipId
  );
  if (!membership) throw new Error('Vínculo não encontrado na organização.');

  const changesOwnerRole =
    membership.roles.includes('owner') !== roles.includes('owner');
  if (changesOwnerRole && !actor.roles.includes('owner')) {
    throw new Error('Somente um proprietário pode alterar o papel de proprietário.');
  }
  if (membership.roles.includes('owner') && !roles.includes('owner')) {
    const activeOwners = (
      await dependencies.repository.listMemberships(actor.organizationId)
    ).filter(
      (item) => item.roles.includes('owner') && item.status === 'active'
    );
    if (activeOwners.length <= 1) {
      throw new Error('A organização precisa manter ao menos um proprietário ativo.');
    }
  }
  if (Number.isNaN(Date.parse(changedAt))) {
    throw new Error('changedAt deve ser uma data ISO válida.');
  }
  const uniqueRoles = Array.from(new Set(roles));
  if (uniqueRoles.length === 0) {
    throw new Error('O vínculo precisa possuir ao menos um papel.');
  }
  const updated = { ...membership, roles: uniqueRoles, updatedAt: changedAt };
  await dependencies.repository.saveMembership(updated);
  await appendIdentityAudit(dependencies, {
    id: `audit-role-${membership.id}-${changedAt}`,
    organizationId: membership.organizationId,
    actorUserId: actor.userId,
    action: 'membership.role_changed',
    entityType: 'organization_membership',
    entityId: membership.id,
    occurredAt: changedAt,
  });
  return updated;
}
