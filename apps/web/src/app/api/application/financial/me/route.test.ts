import { describe, expect, it, vi } from 'vitest';

vi.mock('server-only', () => ({}));

import { GET } from './route';

vi.mock('@/server/application/context', () => ({
  resolveRequestContext: vi.fn(async () => ({
    actor: {
      userId: 'user-1',
      organizationId: 'org-1',
      professionalProfileId: 'prof-1',
      roles: ['professional'],
    },
  })),
}));

vi.mock('@/server/application/financialService', () => ({
  getMyFinancialData: vi.fn(async (_context, _filter) => ({
    professionalId: 'prof-1',
    receivedCents: 15000,
    professionalCreditCents: 10500,
    transactions: [],
    receivables: [
      {
        chargeId: 'ch-1',
        sessionId: 'sess-1',
        appointmentId: 'apt-1',
        patientName: 'João Silva',
        dueAt: '2026-08-01T10:00:00.000Z',
        startsAt: '2026-08-01T10:00:00.000Z',
        endsAt: '2026-08-01T10:50:00.000Z',
        status: 'pending',
        attendanceStatus: 'realizado',
        modalidade: 'online',
        conveniado: true,
        convenioNome: 'Ambev',
        custeadoPelaEmpresa: true,
        amountCents: 15000,
        receivedCents: 0,
        outstandingCents: 15000,
      },
    ],
  })),
}));

describe('GET /api/application/financial/me', () => {
  it('retorna dados financeiros com status de atendimento realizado e dados de convênio', async () => {
    const req = new Request('http://localhost/api/application/financial/me?startDate=2026-08-01&endDate=2026-08-31');
    const res = await GET(req);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.data.receivables).toHaveLength(1);
    expect(body.data.receivables[0].attendanceStatus).toBe('realizado');
    expect(body.data.receivables[0].conveniado).toBe(true);
    expect(body.data.receivables[0].convenioNome).toBe('Ambev');
    expect(body.data.receivables[0].custeadoPelaEmpresa).toBe(true);
  });
});
