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
  closeConvenioInvoice: vi.fn(async (_context, id, body) => ({
    id: 'fatura-123',
    convenioId: id,
    competencia: body.competencia,
    periodoInicio: body.periodoInicio,
    periodoFim: body.periodoFim,
    cobrancaRefs: body.cobrancaRefs,
    totalSessoes: body.cobrancaRefs?.length ?? 5,
    valorCents: 37500,
    status: 'aberta',
  })),
}));

describe('POST /api/application/convenios/[id]/faturas', () => {
  it('recebe cobrancaRefs e fecha a fatura com as sessões selecionadas', async () => {
    const req = new Request('http://localhost/api/application/convenios/conv-1/faturas', {
      method: 'POST',
      body: JSON.stringify({
        competencia: '2026-09',
        periodoInicio: '2026-09-01',
        periodoFim: '2026-09-30',
        cobrancaRefs: ['charge-1', 'charge-2', 'charge-3'],
      }),
    });

    const res = await POST(req, { params: Promise.resolve({ id: 'conv-1' }) });
    expect(res.status).toBe(201);
    const body = await res.json();
    expect(body.data.id).toBe('fatura-123');
    expect(body.data.totalSessoes).toBe(3);
    expect(body.data.cobrancaRefs).toEqual(['charge-1', 'charge-2', 'charge-3']);
  });
});
