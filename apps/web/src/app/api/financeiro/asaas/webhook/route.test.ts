import { describe, expect, it, vi } from 'vitest';
vi.mock('server-only', () => ({}));
vi.mock('@/server/payments/paymentLinkRepository', () => ({ reconcileAsaasPayment: async () => 'unknown' }));
const mocks = vi.hoisted(() => ({ refund: vi.fn(async () => 'processed') }));
vi.mock('@/server/persistence/mysql/convenioRepository', () => ({ reconcileConvenioInvoicePayment: async () => 'unknown', reconcileConvenioInvoiceRefund: mocks.refund }));
import { POST } from './route';

describe('webhook de boleto empresarial', () => {
  it('solicita nova entrega se a fatura ainda não tem o boleto vinculado', async () => {
    const previous = process.env.ASAAS_WEBHOOK_TOKEN;
    process.env.ASAAS_WEBHOOK_TOKEN = 'token-ficticio';
    try {
      const response = await POST(new Request('http://localhost', {
        method: 'POST', headers: { 'asaas-access-token': 'token-ficticio' },
        body: JSON.stringify({ id: 'evt', event: 'PAYMENT_RECEIVED', payment: { id: 'pay', value: 100, externalReference: 'VMPJ-fatura-1' } }),
      }));
      expect(response.status).toBe(503);
    } finally {
      if (previous === undefined) delete process.env.ASAAS_WEBHOOK_TOKEN;
      else process.env.ASAAS_WEBHOOK_TOKEN = previous;
    }
  });

  it('considera somente estornos concluídos e encaminha o total', async () => {
    const previous = process.env.ASAAS_WEBHOOK_TOKEN;
    process.env.ASAAS_WEBHOOK_TOKEN = 'token-ficticio';
    try {
      const response = await POST(new Request('http://localhost', {
        method: 'POST', headers: { 'asaas-access-token': 'token-ficticio' },
        body: JSON.stringify({ id: 'evt', event: 'PAYMENT_PARTIALLY_REFUNDED', payment: {
          id: 'pay', refunds: [{ status: 'DONE', value: 10 }, { status: 'PENDING', value: 5 }],
        } }),
      }));
      expect(response.status).toBe(200);
      expect(mocks.refund).toHaveBeenCalledWith(expect.objectContaining({ refundCents: 1000, paymentId: 'pay' }));
    } finally {
      if (previous === undefined) delete process.env.ASAAS_WEBHOOK_TOKEN;
      else process.env.ASAAS_WEBHOOK_TOKEN = previous;
    }
  });
});
