import { afterEach, describe, expect, it, vi } from 'vitest';
import { createAsaasPayment, deleteAsaasPayment, getAsaasIntegrationStatus, getOrCreateAsaasCustomer } from './asaasAdapter';

const originalEnv = { ...process.env };

afterEach(() => {
  process.env = { ...originalEnv };
  vi.unstubAllGlobals();
});

describe('diagnóstico da integração Asaas', () => {
  it('reconhece produção apenas com API, chave e webhook compatíveis', async () => {
    process.env.ASAAS_API_URL = 'https://api.asaas.com/v3';
    process.env.ASAAS_API_KEY = '$aact_prod_teste';
    process.env.ASAAS_WEBHOOK_TOKEN = 'token-seguro-de-webhook';
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(new Response(JSON.stringify({ data: [] }), { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ data: [{
        url: 'https://app.clinicavivermais.cloud/api/financeiro/asaas/webhook',
        enabled: true,
        interrupted: false,
        sendType: 'SEQUENTIALLY',
        events: ['PAYMENT_CONFIRMED', 'PAYMENT_RECEIVED'],
      }] }), { status: 200 }));
    vi.stubGlobal('fetch', fetchMock);

    const status = await getAsaasIntegrationStatus();

    expect(status).toMatchObject({ environment: 'production', credentialsValid: true, ready: true });
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it('bloqueia uma chave de sandbox apontada para a API de produção', async () => {
    process.env.ASAAS_API_URL = 'https://api.asaas.com/v3';
    process.env.ASAAS_API_KEY = '$aact_hmlg_teste';
    process.env.ASAAS_WEBHOOK_TOKEN = 'token-seguro-de-webhook';
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);

    const status = await getAsaasIntegrationStatus();

    expect(status).toMatchObject({ environment: 'unknown', ready: false });
    expect(status.issues.join(' ')).toContain('não pertencem ao mesmo ambiente');
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('não remove no Asaas uma cobrança já liquidada e evita buscar QR Code Pix para boleto', async () => {
    process.env.ASAAS_API_URL = 'https://api.asaas.com/v3';
    process.env.ASAAS_API_KEY = '$aact_prod_teste';
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(new Response(JSON.stringify({
        id: 'pay-1', customer: 'cus-1', value: 100, billingType: 'BOLETO', status: 'RECEIVED', dueDate: '2026-11-05',
      }), { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({
        id: 'pay-2', customer: 'cus-1', value: 100, billingType: 'BOLETO', status: 'PENDING', dueDate: '2026-11-05',
      }), { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ data: [{ id: 'cus-1', name: 'Antiga', email: 'antigo@example.test' }] }), { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ id: 'cus-1' }), { status: 200 }));
    vi.stubGlobal('fetch', fetchMock);

    expect(await deleteAsaasPayment('pay-1')).toBe(false);
    const created = await createAsaasPayment({ customerId: 'cus-1', value: 100, dueDate: '2026-11-05', description: 'Fatura', billingType: 'BOLETO' });
    expect(created.pixQrCode).toBeUndefined();
    expect(await getOrCreateAsaasCustomer({ name: 'Nova Razão', cpfCnpj: '12345678901234', email: 'novo@example.test' })).toBe('cus-1');
    expect(fetchMock).toHaveBeenCalledTimes(4);
    expect(String(fetchMock.mock.calls[3]?.[0])).toContain('/customers/cus-1');
  });
});
