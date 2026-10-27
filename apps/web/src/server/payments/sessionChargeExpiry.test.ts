import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('server-only', () => ({}));
const mocks = vi.hoisted(() => ({
  pool: { query: vi.fn(), execute: vi.fn() },
  get: vi.fn(), remove: vi.fn(),
}));
vi.mock('@/server/oci/runtime', () => ({ getMysqlPool: () => mocks.pool }));
vi.mock('@/server/adapters/asaasAdapter', () => ({
  getAsaasPayment: mocks.get, deleteAsaasPayment: mocks.remove,
  AsaasPaymentNotFoundError: class extends Error {},
}));
vi.mock('@/server/adapters/interPixAdapter', () => ({
  getInterPixCharge: vi.fn(), cancelInterPixCharge: vi.fn(),
}));
vi.mock('@/server/payments/paymentLinkRepository', () => ({ reconcileSettledInterPixCharge: vi.fn() }));
import { expirarCobrancasPendentes } from './sessionCharge';
import { AsaasPaymentNotFoundError } from '@/server/adapters/asaasAdapter';

beforeEach(() => {
  vi.resetAllMocks();
  mocks.pool.query.mockImplementation(async (sql: string) => [sql.includes('SELECT c.ref_core')
    ? [{ cobranca_ref: 'charge-test', provedor_ref: 'payment-test', checkout_provedor: 'asaas' }] : []]);
  mocks.pool.execute.mockResolvedValue([{ affectedRows: 1 }]);
  mocks.get.mockResolvedValue({ status: 'PENDING' });
  mocks.remove.mockResolvedValue(true);
  vi.spyOn(console, 'error').mockImplementation(() => {});
});

describe('expiração confirma cancelamento externo', () => {
  it('mantém a cobrança local quando o Asaas recusa a remoção', async () => {
    mocks.remove.mockResolvedValue(false);
    expect(await expirarCobrancasPendentes()).toEqual({ expired: 0, paid: 0, failed: 1 });
    expect(mocks.pool.execute).not.toHaveBeenCalled();
    expect(mocks.remove).toHaveBeenCalledExactlyOnceWith('payment-test');
  });
  it('não tenta remover pagamento quando a consulta falha', async () => {
    mocks.get.mockRejectedValue(new Error('Falha simulada de consulta'));
    expect(await expirarCobrancasPendentes()).toEqual({ expired: 0, paid: 0, failed: 1 });
    expect(mocks.remove).not.toHaveBeenCalled();
    expect(mocks.pool.execute).not.toHaveBeenCalled();
  });
  it('expira quando o provedor confirma a remoção', async () => {
    expect(await expirarCobrancasPendentes()).toEqual({ expired: 1, paid: 0, failed: 0 });
    expect(mocks.remove).toHaveBeenCalledExactlyOnceWith('payment-test');
    expect(mocks.pool.execute).toHaveBeenCalledTimes(2);
  });
  it('aceita cobrança já removida sem tentar removê-la novamente', async () => {
    mocks.get.mockRejectedValue(new AsaasPaymentNotFoundError('Removida'));
    expect(await expirarCobrancasPendentes()).toEqual({ expired: 1, paid: 0, failed: 0 });
    expect(mocks.remove).not.toHaveBeenCalled();
  });
  it('preserva pagamento confirmado', async () => {
    mocks.get.mockResolvedValue({ status: 'RECEIVED' });
    expect(await expirarCobrancasPendentes()).toEqual({ expired: 0, paid: 1, failed: 0 });
    expect(mocks.remove).not.toHaveBeenCalled();
    expect(mocks.pool.execute).not.toHaveBeenCalled();
  });

  it('expira pelo pagamento remoto do checkout agrupado, mesmo sem provedor na cobrança membro', async () => {
    mocks.pool.query.mockImplementation(async (sql: string) => [
      sql.includes('financeiro_checkout_cobrancas')
        ? [{ cobranca_ref: 'charge-member', provedor_ref: 'payment-group', checkout_provedor: 'asaas' }]
        : [],
    ]);

    expect(await expirarCobrancasPendentes()).toEqual({ expired: 1, paid: 0, failed: 0 });
    expect(mocks.get).toHaveBeenCalledExactlyOnceWith('payment-group');
    expect(mocks.remove).toHaveBeenCalledExactlyOnceWith('payment-group');
  });
});
