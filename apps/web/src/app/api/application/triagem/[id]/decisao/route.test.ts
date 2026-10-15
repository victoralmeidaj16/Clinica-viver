import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('server-only', () => ({}));

const readMock = vi.fn();
const mutateMock = vi.fn();
vi.mock('@/server/persistence/captureRepository', () => ({
  captureStateAsSnapshot: vi.fn((state) => state),
  getCaptureRepository: vi.fn(() => ({ read: readMock, mutate: mutateMock })),
}));

vi.mock('@/server/viverMaisConfirmToken', () => ({
  validarTokenConfirmacao: vi.fn((_leadId: string, psiId: string, token: string | null) =>
    psiId === 'psi-1' && token === 'token-valido'
  ),
}));

const aceitarPacienteMock = vi.fn();
vi.mock('@/server/application/viverMaisRodizio', () => ({
  aceitarPaciente: (...args: unknown[]) => aceitarPacienteMock(...args),
}));

const reconciliarPacientesMock = vi.fn();
vi.mock('@/server/application/patientPromotion', () => ({
  reconciliarPacientes: (...args: unknown[]) => reconciliarPacientesMock(...args),
}));

import { GET, POST } from './route';

const params = Promise.resolve({ id: 'lead-1' });
const url = 'http://localhost/api/application/triagem/lead-1/decisao?psi=psi-1&t=token-valido';

describe('/api/application/triagem/[id]/decisao', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    readMock.mockResolvedValue({
      triagensPacientes: [{ id: 'lead-1', psicologoAlocadoId: 'psi-1', status: 'AGUARDANDO_CONTATO' }],
    });
    mutateMock.mockImplementation(async (callback) => callback({}).result);
    reconciliarPacientesMock.mockResolvedValue(1);
  });

  it('informa que a decisão ainda está pendente', async () => {
    const response = await GET(new Request(url), { params });
    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({ success: true, estado: 'PENDENTE' });
  });

  it('retoma diretamente a confirmação de contato após o aceite', async () => {
    readMock.mockResolvedValue({
      triagensPacientes: [{ id: 'lead-1', psicologoAlocadoId: 'psi-1', status: 'AGUARDANDO_CONTATO', aceitoEm: '2026-10-15T12:00:00.000Z' }],
    });
    const response = await GET(new Request(url), { params });
    expect(await response.json()).toMatchObject({ success: true, estado: 'ACEITO' });
  });

  it('persiste o aceite e promove o lead a paciente responsável', async () => {
    aceitarPacienteMock.mockReturnValue({
      next: { triagensPacientes: [], cadastrosPsicologos: [] },
      result: { kind: 'accepted', lead: { id: 'lead-1', aceitoEm: '2026-10-15T12:00:00.000Z' } },
    });
    const response = await POST(new Request(url, { method: 'POST' }), { params });
    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({ success: true, estado: 'ACEITO' });
    expect(reconciliarPacientesMock).toHaveBeenCalledTimes(1);
  });

  it('rejeita token inválido', async () => {
    const response = await GET(new Request(url.replace('token-valido', 'invalido')), { params });
    expect(response.status).toBe(403);
  });
});
