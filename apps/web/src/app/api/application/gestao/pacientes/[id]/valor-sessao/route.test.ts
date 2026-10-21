import { describe, expect, it, vi } from 'vitest';

const state = vi.hoisted(() => ({
  requireManagement: vi.fn(),
  readSession: vi.fn(async () => ({ organizationId: 'org' })),
  update: vi.fn(),
}));

vi.mock('@/server/viverMaisGestaoAuth', () => ({
  exigirGestao: state.requireManagement,
  NaoAutorizadoError: class NaoAutorizadoError extends Error {},
}));
vi.mock('@/server/auth', () => ({ readSession: state.readSession }));
vi.mock('@/server/persistence/mysql/patientSessionPricing', () => ({
  updatePatientSessionPricing: state.update,
  validatePatientSessionPricing: (input: Record<string, unknown>) => {
    const amount = input.customAmountCents;
    if (input.category !== 'personalizado' || !Number.isSafeInteger(amount) || typeof amount !== 'number' || amount <= 0) {
      throw new Error('Informe um valor personalizado válido para a sessão.');
    }
    return { category: 'personalizado', customAmountCents: amount };
  },
}));
vi.mock('@/server/application/http', () => ({
  readJson: async (request: Request) => request.json(),
  success: (data: unknown) => Response.json({ ok: true, data }),
  failure: (error: unknown) => Response.json({ ok: false, error: error instanceof Error ? error.message : 'Erro interno.' }, { status: 400 }),
  ApplicationError: class ApplicationError extends Error {},
}));

import { PUT } from './route';

describe('PUT valor-sessao de paciente pela Gestão', () => {
  it('valida e atualiza apenas no escopo da organização da sessão', async () => {
    const response = await PUT(new Request('http://localhost', {
      method: 'PUT', body: JSON.stringify({ category: 'personalizado', customAmountCents: 7500 }),
    }), { params: Promise.resolve({ id: 'patient' }) });

    expect(response.status).toBe(200);
    expect(state.requireManagement).toHaveBeenCalledOnce();
    expect(state.update).toHaveBeenCalledWith('org', 'patient', { category: 'personalizado', customAmountCents: 7500 });
  });

  it('não chama persistência quando a categoria ou valor são inválidos', async () => {
    state.update.mockClear();
    const response = await PUT(new Request('http://localhost', {
      method: 'PUT', body: JSON.stringify({ category: 'personalizado', customAmountCents: 0 }),
    }), { params: Promise.resolve({ id: 'patient' }) });

    expect(response.status).toBe(400);
    expect(state.update).not.toHaveBeenCalled();
  });
});
