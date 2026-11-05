import { describe, expect, it, vi } from 'vitest';

vi.mock('server-only', () => ({}));

import { PATCH } from './route';

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

vi.mock('@/server/application/agendaService', () => ({
  cancelAgendaAppointment: vi.fn(async (_context, id, motivo) => ({
    cancelled: true,
    id,
    motivo,
  })),
  confirmAgendaAppointmentCompleted: vi.fn(async (_context, id) => ({
    completed: true,
    id,
  })),
  updateAgendaAppointmentChargeDue: vi.fn(async (_context, id, dueAt) => ({
    updatedDue: true,
    id,
    dueAt,
  })),
  rescheduleAgendaAppointment: vi.fn(async (_context, id, startsAt, endsAt) => ({
    rescheduled: true,
    id,
    startsAt,
    endsAt,
  })),
  editAgendaAppointment: vi.fn(async (_context, id, input) => ({
    edited: true,
    id,
    ...input,
  })),
}));

vi.mock('@/server/application/agendaFaltaService', () => ({
  registrarFaltaNaAgenda: vi.fn(async (_context, id, input) => ({ noShow: true, id, ...input })),
}));

describe('PATCH /api/application/agenda/agendamentos/[id]', () => {
  it('registra a falta com a decisão de cobrança', async () => {
    const req = new Request('http://localhost/api/application/agenda/agendamentos/123', {
      method: 'PATCH',
      body: JSON.stringify({ action: 'no_show', cobrar: false, expectedVersion: 4 }),
    });
    const res = await PATCH(req, { params: Promise.resolve({ id: '123' }) });
    expect(res.status).toBe(200);
    expect((await res.json()).data).toMatchObject({ noShow: true, id: '123', cobrar: false, expectedVersion: 4 });
  });

  it('não presume cobrança quando a decisão não vem no pedido', async () => {
    const req = new Request('http://localhost/api/application/agenda/agendamentos/123', {
      method: 'PATCH',
      body: JSON.stringify({ action: 'no_show' }),
    });
    const res = await PATCH(req, { params: Promise.resolve({ id: '123' }) });
    expect(res.status).toBe(400);
  });

  it('processa action: edit com sucesso', async () => {
    const req = new Request('http://localhost/api/application/agenda/agendamentos/123', {
      method: 'PATCH',
      body: JSON.stringify({
        action: 'edit',
        startsAt: '2026-10-15T14:00:00.000Z',
        endsAt: '2026-10-15T14:50:00.000Z',
        modalidade: 'presencial',
        status: 'realizado',
      }),
    });
    const res = await PATCH(req, { params: Promise.resolve({ id: '123' }) });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.data.edited).toBe(true);
    expect(body.data.modalidade).toBe('presencial');
    expect(body.data.status).toBe('realizado');
  });

  it('ignora status cancelado na edição: cancelar exige o fluxo próprio', async () => {
    const req = new Request('http://localhost/api/application/agenda/agendamentos/123', {
      method: 'PATCH',
      body: JSON.stringify({ action: 'edit', status: 'cancelado' }),
    });
    const res = await PATCH(req, { params: Promise.resolve({ id: '123' }) });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.data.edited).toBe(true);
    expect(body.data.status).toBeUndefined();
  });

  it('processa action: reschedule com sucesso', async () => {
    const req = new Request('http://localhost/api/application/agenda/agendamentos/123', {
      method: 'PATCH',
      body: JSON.stringify({
        action: 'reschedule',
        startsAt: '2026-10-16T10:00:00.000Z',
        endsAt: '2026-10-16T10:50:00.000Z',
      }),
    });
    const res = await PATCH(req, { params: Promise.resolve({ id: '123' }) });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.data.rescheduled).toBe(true);
  });

  it('processa action: complete com sucesso', async () => {
    const req = new Request('http://localhost/api/application/agenda/agendamentos/123', {
      method: 'PATCH',
      body: JSON.stringify({ action: 'complete' }),
    });
    const res = await PATCH(req, { params: Promise.resolve({ id: '123' }) });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.data.completed).toBe(true);
  });
});
