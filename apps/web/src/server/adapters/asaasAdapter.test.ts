import { afterEach, describe, expect, it, vi } from 'vitest';
import { getAsaasIntegrationStatus } from './asaasAdapter';

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
});
