import { beforeEach, expect, it, vi } from 'vitest';
import type { FinancialCharge } from '@thats-life/core';

vi.mock('server-only', () => ({}));
const store = vi.hoisted(() => ({
  sessions: { getById: vi.fn() },
  appointments: { getById: vi.fn(), list: vi.fn(async () => []) },
}));
vi.mock('./store', () => ({ getApplicationStore: () => store }));

import { competenciaFiscalDaCobranca } from './clinicFinanceService';

const COBRANCA = { sessionId: 'apt-ref-1', patientId: 'pat-1', professionalId: 'pro-1' } as FinancialCharge;

beforeEach(() => {
  vi.clearAllMocks();
  store.sessions.getById.mockResolvedValue(null);
  store.appointments.getById.mockResolvedValue(null);
});

/** Pagamento não é serviço prestado: a nota exige atendimento concluído, mesmo com a falta quitada. */
it('não emite NFS-e de falta paga vinculada ao agendamento', async () => {
  store.appointments.getById.mockResolvedValue({ status: 'no_show', startsAt: '2099-01-01T12:00:00Z' });
  await expect(competenciaFiscalDaCobranca('org-1', COBRANCA))
    .rejects.toMatchObject({ code: 'INVALID_FISCAL_STATE', status: 422 });
});

it('não emite NFS-e de falta paga vinculada à sessão registrada', async () => {
  store.sessions.getById.mockResolvedValue({ status: 'no_show', scheduledStart: '2099-01-01T12:00:00Z' });
  await expect(competenciaFiscalDaCobranca('org-1', COBRANCA))
    .rejects.toMatchObject({ code: 'INVALID_FISCAL_STATE', status: 422 });
});

it('segue emitindo para atendimento concluído', async () => {
  store.appointments.getById.mockResolvedValue({ status: 'completed', startsAt: '2026-01-01T12:00:00Z' });
  await expect(competenciaFiscalDaCobranca('org-1', COBRANCA)).resolves.toMatchObject({ competencia: expect.any(String) });
});
