import { beforeEach, describe, expect, it, vi } from 'vitest';
vi.mock('server-only', () => ({}));
vi.mock('@/server/application/context', () => ({ resolveRequestContext: vi.fn(async () => ({ actor: {} })) }));
const decide = vi.hoisted(() => vi.fn(async () => ({ appointments: [] })));
vi.mock('@/server/application/rescheduleRequestService', () => ({ decideRescheduleRequest: decide }));
vi.mock('@/server/oci/runtime', () => ({ isMysqlConfigured: () => true }));
import { PATCH } from './route';

beforeEach(() => vi.clearAllMocks());

describe('PATCH /api/application/agenda/reagendamentos/[id]', () => {
  it.each(['accept', 'reject'] as const)('encaminha a decisão %s autenticada', async decision => {
    const response = await PATCH(new Request('http://localhost', { method: 'PATCH', body: JSON.stringify({ decision }) }),
      { params: Promise.resolve({ id: 'request-1' }) });
    expect(response.status).toBe(200);
    expect(decide).toHaveBeenCalledWith(expect.anything(), 'request-1', decision);
  });

  it('rejeita uma ação desconhecida', async () => {
    const response = await PATCH(new Request('http://localhost', { method: 'PATCH', body: JSON.stringify({ decision: 'later' }) }),
      { params: Promise.resolve({ id: 'request-1' }) });
    expect(response.status).toBe(400);
    expect(decide).not.toHaveBeenCalled();
  });
});
