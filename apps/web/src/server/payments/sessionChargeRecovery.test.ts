import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('server-only', () => ({}));

const mocks = vi.hoisted(() => ({
  query: vi.fn(),
  guarantee: vi.fn(),
}));

vi.mock('@/server/oci/runtime', () => ({
  getMysqlPool: () => ({ query: mocks.query }),
}));
vi.mock('./sessionCharge', async (importOriginal) => ({
  ...(await importOriginal<typeof import('./sessionCharge')>()),
  garantirCobrancaDaSessao: mocks.guarantee,
}));

import { recuperarCobrancasPosSessaoPendentes } from './sessionChargeRecovery';

afterEach(() => vi.useRealTimers());

describe('recuperação de cobrança após conclusão', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-10-26T12:00:00.000Z'));
    mocks.query.mockResolvedValue([[{ id: 'appointment-1', realizado_em: '2026-10-26T11:00:00.000Z' }], []]);
  });

  it('refaz a cobrança ausente com três dias de prazo após a realização', async () => {
    mocks.guarantee.mockResolvedValue('created');

    await expect(recuperarCobrancasPosSessaoPendentes()).resolves.toEqual({ created: 1, existing: 0, failed: 0 });
    expect(mocks.guarantee).toHaveBeenCalledWith('appointment-1', '2026-10-29T11:00:00.000Z');
  });

  it('recupera o agendamento ainda não realizado com o vencimento escolhido', async () => {
    mocks.query.mockResolvedValue([[{ id: 'appointment-2', realizado_em: null, cobranca_vence_em: '2026-11-10 15:00:00.000' }], []]);
    mocks.guarantee.mockResolvedValue('created');
    await recuperarCobrancasPosSessaoPendentes();
    expect(mocks.guarantee).toHaveBeenCalledWith('appointment-2', '2026-11-10T15:00:00.000Z');
    expect(mocks.query.mock.calls[0][0]).toContain("a.status IN ('agendado', 'confirmado')");
  });

  it('mantém a cobrança para nova tentativa quando a emissão volta a falhar', async () => {
    mocks.guarantee.mockResolvedValue('failed');

    await expect(recuperarCobrancasPosSessaoPendentes()).resolves.toEqual({ created: 0, existing: 0, failed: 1 });
  });
});
