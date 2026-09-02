import { describe, expect, it, vi } from 'vitest';

vi.mock('server-only', () => ({}));

import { POST } from './route';

vi.mock('@/server/application/context', () => ({
  resolveRequestContext: vi.fn(async () => ({
    actor: {
      userId: 'user-admin',
      organizationId: 'org-1',
      roles: ['admin'],
    },
  })),
}));

vi.mock('@/server/application/convenioService', () => ({
  cancelConvenioInvoice: vi.fn(async (_context, id, faturaId) => ({
    cancelled: true,
    id: faturaId,
    convenioId: id,
  })),
}));

describe('POST /api/application/convenios/[id]/faturas/[faturaId]/cancelar', () => {
  it('cancela a fatura e libera as sessões com sucesso', async () => {
    const req = new Request('http://localhost/api/application/convenios/conv-1/faturas/fat-123/cancelar', {
      method: 'POST',
    });

    const res = await POST(req, {
      params: Promise.resolve({ id: 'conv-1', faturaId: 'fat-123' }),
    });

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.data.cancelled).toBe(true);
    expect(body.data.id).toBe('fat-123');
  });
});
