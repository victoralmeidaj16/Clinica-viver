import { beforeEach, expect, it, vi } from 'vitest';
import type { RequestContext } from './context';
vi.mock('server-only', () => ({}));
const { appointment } = vi.hoisted(() => ({ appointment: {
  id: 'appt', organizationId: 'org', patientId: 'patient', professionalId: 'pro', status: 'cancelled',
} }));
vi.mock('./store', () => ({
  getApplicationStore: () => ({ appointments: { getById: async () => appointment }, identities: {} }),
  persistApplicationState: vi.fn(async () => {}),
}));
vi.mock('@/server/payments/sessionCharge', () => ({ cancelarCobrancaDaSessao: vi.fn() }));
import { changeAppointment } from './appointmentService';
import { cancelarCobrancaDaSessao } from '@/server/payments/sessionCharge';
const context: RequestContext = {
  actor: { actorType: 'staff', userId: 'user', organizationId: 'org', membershipId: 'member',
    membershipStatus: 'active', roles: ['professional'], professionalProfileId: 'pro' },
  correlationId: 'correlation', idempotencyKey: 'new-command',
};
beforeEach(() => vi.clearAllMocks());
it('retoma o cancelamento financeiro com uma nova chave após cancelar a sessão', async () => {
  vi.mocked(cancelarCobrancaDaSessao).mockResolvedValueOnce('failed').mockResolvedValueOnce('cancelled');
  await expect(changeAppointment(context, 'appt', { action: 'cancel' })).rejects.toMatchObject({ status: 502 });
  await expect(changeAppointment({ ...context, idempotencyKey: 'retry' }, 'appt', { action: 'cancel' }))
    .resolves.toMatchObject({ appointment, idempotentReplay: true });
});
it('a retomada não permite cancelar cobrança de outro profissional', async () => {
  await expect(changeAppointment({ ...context, actor: { ...context.actor, professionalProfileId: 'other' } }, 'appt', { action: 'cancel' }))
    .rejects.toThrow('Acesso negado');
  expect(cancelarCobrancaDaSessao).not.toHaveBeenCalled();
});
