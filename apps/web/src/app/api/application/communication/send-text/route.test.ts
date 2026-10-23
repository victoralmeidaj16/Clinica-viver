import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({ delivery: vi.fn(), context: vi.fn() }));
vi.mock('@/server/communication/whatsappDelivery', () => ({ deliverWhatsApp: mocks.delivery }));
vi.mock('@/server/application/context', () => ({ resolveRequestContext: mocks.context }));
vi.mock('@/server/oci/runtime', () => ({ isMysqlConfigured: () => true }));
import { POST } from './route';

const request = () => new Request('http://localhost/api/application/communication/send-text', {
  method: 'POST', headers: { 'Content-Type': 'application/json', 'Idempotency-Key': 'same-key' },
  body: JSON.stringify({ number: '+55 (11) 99999-9999', text: ' Olá ' }),
});

beforeEach(() => {
  vi.clearAllMocks();
  vi.stubEnv('EVOLUTION_API_URL', 'https://provider.invalid');
  vi.stubEnv('EVOLUTION_API_KEY', 'test');
  vi.stubEnv('EVOLUTION_INSTANCE_NAME', 'test');
  mocks.context.mockResolvedValue({ actor: { organizationId: 'org', userId: 'user' }, idempotencyKey: 'same-key' });
});
afterEach(() => vi.unstubAllEnvs());

describe('send-text delivery outcomes', () => {
  it('returns 409 for a persisted content mismatch', async () => {
    mocks.delivery.mockResolvedValue({ state: 'conflict' });
    const response = await POST(request());
    expect(response.status).toBe(409);
    expect((await response.json()).error.code).toBe('IDEMPOTENCY_CONFLICT');
  });

  it.each(['sending', 'unknown'])('returns an actionable conflict for %s without claiming delivery', async (state) => {
    mocks.delivery.mockResolvedValue({ state });
    const response = await POST(request());
    expect(response.status).toBe(409);
    expect((await response.json()).error.code).toBe('DELIVERY_UNCERTAIN');
  });

  it('returns the stored provider ID and scopes the key to the authenticated sender', async () => {
    mocks.delivery.mockResolvedValue({ state: 'sent', providerMessageId: 'persisted-id' });
    const response = await POST(request());
    expect(response.status).toBe(200);
    expect((await response.json()).data).toEqual({ sent: true, messageId: 'persisted-id' });
    expect(mocks.context).toHaveBeenCalledWith(expect.any(Request), true);
    expect(mocks.delivery).toHaveBeenCalledWith(expect.objectContaining({
      scope: 'send-text:org:user', key: 'same-key', number: '5511999999999', text: 'Olá',
    }));
  });

  it('reports an explicit provider rejection as 502', async () => {
    mocks.delivery.mockResolvedValue({ state: 'rejected' });
    const response = await POST(request());
    expect(response.status).toBe(502);
    expect((await response.json()).error.code).toBe('EVOLUTION_DELIVERY_FAILED');
  });
});
