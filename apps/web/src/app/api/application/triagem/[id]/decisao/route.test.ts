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
const ofertaExpiradaMock = vi.fn(() => false);
vi.mock('@/server/application/viverMaisRodizio', () => ({
  aceitarPaciente: (...args: unknown[]) => aceitarPacienteMock(...args),
  ofertaExpirada: (...args: unknown[]) => ofertaExpiradaMock(...(args as [])),
}));

const reconciliarPacientesMock = vi.fn();
vi.mock('@/server/application/patientPromotion', () => ({
  reconciliarPacientes: (...args: unknown[]) => reconciliarPacientesMock(...args),
}));

// Nenhum teste envia mensagem real: o módulo inteiro de WhatsApp é substituído.
const avisarConfirmacaoPacienteMock = vi.fn();
vi.mock('@/server/application/viverMaisWhatsApp', () => ({
  avisarConfirmacaoPaciente: (...args: unknown[]) => avisarConfirmacaoPacienteMock(...args),
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
    ofertaExpiradaMock.mockReturnValue(false);
    avisarConfirmacaoPacienteMock.mockResolvedValue({ situacao: 'enviada' });
  });

  describe('orientações ao paciente no aceite (especificação 5.03, 7.02 e 12.01)', () => {
    const aceito = { id: 'lead-1', telefone: '5500000000000', nomePaciente: 'Paciente Fictício', aceitoEm: '2026-10-15T12:00:00.000Z' };

    it('envia as orientações quando o psicólogo aceita', async () => {
      aceitarPacienteMock.mockReturnValue({
        next: { triagensPacientes: [], cadastrosPsicologos: [] },
        result: { kind: 'accepted', lead: aceito },
      });
      const response = await POST(new Request(url, { method: 'POST' }), { params });

      expect(response.status).toBe(200);
      expect(avisarConfirmacaoPacienteMock).toHaveBeenCalledExactlyOnceWith(aceito);
    });

    it.each(['already_accepted', 'already_confirmed', 'expired', 'conflict', 'not_found'])(
      'não envia orientações quando o resultado é %s', async (kind) => {
        aceitarPacienteMock.mockReturnValue({
          next: { triagensPacientes: [], cadastrosPsicologos: [] },
          result: { kind, lead: aceito },
        });
        await POST(new Request(url, { method: 'POST' }), { params });
        expect(avisarConfirmacaoPacienteMock).not.toHaveBeenCalled();
      }
    );

    it('falha no envio não desfaz o aceite já gravado', async () => {
      aceitarPacienteMock.mockReturnValue({
        next: { triagensPacientes: [], cadastrosPsicologos: [] },
        result: { kind: 'accepted', lead: aceito },
      });
      avisarConfirmacaoPacienteMock.mockRejectedValue(new Error('provedor fora do ar'));
      const response = await POST(new Request(url, { method: 'POST' }), { params });

      expect(response.status).toBe(200);
      expect(await response.json()).toMatchObject({ success: true, estado: 'ACEITO' });
      expect(reconciliarPacientesMock).toHaveBeenCalledTimes(1);
    });
  });

  it('não abre a decisão de uma oferta vencida', async () => {
    ofertaExpiradaMock.mockReturnValue(true);
    const response = await GET(new Request(url), { params });
    expect(response.status).toBe(409);
    expect((await response.json()).error).toContain('prazo de 24h');
  });

  it('recusa o aceite de uma oferta vencida sem promover o paciente', async () => {
    aceitarPacienteMock.mockReturnValue({
      next: { triagensPacientes: [], cadastrosPsicologos: [] },
      result: { kind: 'expired', lead: { id: 'lead-1' } },
    });
    const response = await POST(new Request(url, { method: 'POST' }), { params });
    expect(response.status).toBe(409);
    expect(reconciliarPacientesMock).not.toHaveBeenCalled();
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
