import { beforeEach, describe, expect, it, vi } from 'vitest';
vi.mock('server-only', () => ({}));
vi.mock('@/server/http/publicRequest', () => ({ rateLimited: () => false, validCpf: () => true }));
vi.mock('@/server/payments/paymentLinkRepository', () => ({
  reserveAppointmentChargeBatch: vi.fn(), claimCheckoutProvider: vi.fn(),
  bindBatchProviderPayment: vi.fn(), reconcileSettledInterPixCharge: vi.fn(),
}));
vi.mock('@/server/adapters/asaasAdapter', () => ({
  createAsaasPayment: vi.fn(), getOrCreateAsaasCustomer: vi.fn(),
  getAsaasPayment: vi.fn(), findAsaasPaymentByExternalReference: vi.fn(),
}));
vi.mock('@/server/adapters/interPixAdapter', () => ({ createInterPixCharge: vi.fn(), getInterPixCharge: vi.fn() }));
import { POST } from './route';
import * as repository from '@/server/payments/paymentLinkRepository';
import * as asaas from '@/server/adapters/asaasAdapter';
import * as inter from '@/server/adapters/interPixAdapter';
const checkout = {
  id: 'checkout', externalReference: 'VM-a', chargeId: 'a', organizationId: 'org', patientId: 'patient',
  patientName: 'Paciente', patientCpf: '52998224725', amountCents: 20000, professionalName: 'Profissional',
  dueAt: '2099-01-01T12:00:00Z', subtotalCents: 20000, discountCents: 0, chargeIds: ['a', 'b'], sessionStarts: [],
  providerPaymentId: 'remote',
};
const request = (paymentMethod: string) => new Request('http://localhost/api/pagamento/sessoes/gerar', {
  method: 'POST', body: JSON.stringify({ tokens: ['a'.repeat(32), 'b'.repeat(32)], cpf: checkout.patientCpf, paymentMethod }),
});
beforeEach(() => {
  vi.resetAllMocks();
  vi.mocked(repository.reserveAppointmentChargeBatch).mockResolvedValue(checkout);
});
describe('retomar pagamento agrupado sem nova emissão', () => {
  it('recupera o QR Code existente', async () => {
    vi.mocked(repository.claimCheckoutProvider).mockResolvedValue('inter');
    vi.mocked(inter.getInterPixCharge).mockResolvedValue({ id: 'remote', value: 200, status: 'ATIVA', pixCopiaECola: 'existing-code', pixQrCode: '', settlements: [] });
    const response = await POST(request('PIX'));
    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({ pixCopiaECola: 'existing-code' });
    expect(inter.getInterPixCharge).toHaveBeenCalledWith('remote');
    expect(inter.createInterPixCharge).not.toHaveBeenCalled();
  });
  it('recupera o link de cartão existente', async () => {
    vi.mocked(repository.claimCheckoutProvider).mockResolvedValue('asaas');
    vi.mocked(asaas.getAsaasPayment).mockResolvedValue({ id: 'remote', customer: 'customer', value: 200, status: 'PENDING', billingType: 'CREDIT_CARD', dueDate: '2099-01-01', invoiceUrl: 'https://example.test/invoice' });
    const response = await POST(request('CREDIT_CARD'));
    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({ invoiceUrl: 'https://example.test/invoice' });
    expect(asaas.getAsaasPayment).toHaveBeenCalledWith('remote');
    expect(asaas.createAsaasPayment).not.toHaveBeenCalled();
    expect(asaas.getOrCreateAsaasCustomer).not.toHaveBeenCalled();
  });
  it('recusa troca de provedor de um pagamento existente', async () => {
    vi.mocked(repository.claimCheckoutProvider).mockResolvedValue('inter');
    expect((await POST(request('CREDIT_CARD'))).status).toBe(409);
    expect(asaas.createAsaasPayment).not.toHaveBeenCalled();
  });
});
