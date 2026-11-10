import { beforeEach, expect, it, vi } from 'vitest';
import type { RequestContext } from './context';
vi.mock('server-only', () => ({}));
const mocks = vi.hoisted(() => ({ mysql: true, update: vi.fn() }));
vi.mock('@/server/oci/runtime', () => ({ isMysqlConfigured: () => mocks.mysql }));
vi.mock('@/server/payments/chargeDueByCharge', () => ({ atualizarVencimentoPorCobranca: mocks.update }));
import { updateClinicChargeDue } from './clinicChargeDueService';

const context: RequestContext = {
  actor: { actorType: 'staff', organizationId: 'org-1', userId: 'admin-1', membershipId: 'member-1',
    membershipStatus: 'active', roles: ['admin'] }, correlationId: 'test',
};
const body = { dueAt: '2099-01-02T19:30:00-03:00' };
beforeEach(() => { vi.clearAllMocks(); mocks.mysql = true; mocks.update.mockResolvedValue('updated'); });

it.each(['professional', 'billing'] as const)('nega a alteração ao perfil %s', async (role) => {
  const denied = { ...context, actor: { ...context.actor, roles: [role] } };
  await expect(updateClinicChargeDue(denied, 'charge-1', body)).rejects.toMatchObject({ status: 403 });
  expect(mocks.update).not.toHaveBeenCalled();
});

it('usa a organização da sessão autenticada, nunca a do corpo', async () => {
  await expect(updateClinicChargeDue(context, 'charge-1', { ...body, organizationId: 'org-2' }))
    .resolves.toEqual({ updated: true, pending: false });
  expect(mocks.update).toHaveBeenCalledWith({ organizationId: 'org-1', chargeId: 'charge-1', dueAt: '2099-01-02T22:30:00.000Z' });
});

it('informa quando a atualização no provedor ficou pendente', async () => {
  mocks.update.mockResolvedValue('queued');
  await expect(updateClinicChargeDue(context, 'charge-1', body)).resolves.toEqual({ updated: true, pending: true });
});

it.each([undefined, {}, { dueAt: 5 }, { dueAt: 'amanhã' }])('recusa vencimento inválido %j', async (invalid) => {
  await expect(updateClinicChargeDue(context, 'charge-1', invalid)).rejects.toMatchObject({ status: 400 });
  expect(mocks.update).not.toHaveBeenCalled();
});

it.each([['not_found', 404], ['paid', 409], ['invalid', 400], ['covered', 409]] as const)(
  'traduz o resultado %s para HTTP %i', async (outcome, status) => {
    mocks.update.mockResolvedValue(outcome);
    await expect(updateClinicChargeDue(context, 'charge-1', body)).rejects.toMatchObject({ status });
  });

it('não simula a alteração sem banco configurado', async () => {
  mocks.mysql = false;
  await expect(updateClinicChargeDue(context, 'charge-1', body)).rejects.toMatchObject({ status: 503 });
  expect(mocks.update).not.toHaveBeenCalled();
});
