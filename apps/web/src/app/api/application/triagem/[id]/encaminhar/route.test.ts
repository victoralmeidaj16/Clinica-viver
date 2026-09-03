import { beforeEach, describe, expect, it, vi } from 'vitest';
import { POST } from './route';

vi.mock('server-only', () => ({}));

const mutateMock = vi.fn();
vi.mock('@/server/persistence/captureRepository', () => ({
  captureStateAsSnapshot: vi.fn((state) => state),
  getCaptureRepository: vi.fn(() => ({
    mutate: mutateMock,
  })),
}));

vi.mock('@/server/viverMaisConfirmToken', () => ({
  validarTokenConfirmacao: vi.fn((_leadId: string, psiId: string, token: string | null) => {
    return token === 'token-valido' && psiId === 'psi-1';
  }),
}));

const avisarTransbordoMock = vi.fn();
const avisarCoordenacaoMock = vi.fn();
vi.mock('@/server/application/viverMaisWhatsApp', () => ({
  avisarTransbordo: (...args: unknown[]) => avisarTransbordoMock(...args),
  avisarCoordenacao: (...args: unknown[]) => avisarCoordenacaoMock(...args),
}));

const avisarAlocacaoPsicologoPorEmailMock = vi.fn();
vi.mock('@/server/application/triagemEmail', () => ({
  avisarAlocacaoPsicologoPorEmail: (...args: unknown[]) =>
    avisarAlocacaoPsicologoPorEmailMock(...args),
}));

vi.mock('@/server/application/viverMaisRodizio', () => ({
  encaminharParaProximo: vi.fn((_snapshot, leadId, _psicologoId) => {
    if (leadId === 'lead-404') {
      return { snapshot: {}, situacao: 'nao_encontrado' };
    }
    if (leadId === 'lead-conflito') {
      return { snapshot: {}, situacao: 'nao_aplicavel', lead: { id: leadId } };
    }
    if (leadId === 'lead-sem-candidato') {
      return {
        snapshot: {},
        situacao: 'sem_candidato',
        lead: { id: leadId, protocolo: 'VM-999999' },
      };
    }
    return {
      snapshot: {},
      situacao: 'encaminhado',
      lead: { id: leadId, protocolo: 'VM-123456', psicologoNome: 'Dr. Anterior' },
      psicologoNovo: { id: 'psi-2', nomeCompleto: 'Dra. Nova', email: 'nova@example.com' },
      psicologoAnteriorNome: 'Dr. Anterior',
    };
  }),
}));

describe('POST /api/application/triagem/[id]/encaminhar', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mutateMock.mockImplementation(async (callback) => {
      const { result } = callback({});
      return result;
    });
  });

  it('rejeita requisição com token inválido ou ausente com HTTP 403', async () => {
    const request = new Request('http://localhost/api/application/triagem/lead-1/encaminhar?psi=psi-1&t=invalido', {
      method: 'POST',
    });
    const params = Promise.resolve({ id: 'lead-1' });

    const response = await POST(request, { params });
    expect(response.status).toBe(403);
    const json = await response.json();
    expect(json.success).toBe(false);
  });

  it('retorna 404 se a triagem não for encontrada', async () => {
    const request = new Request('http://localhost/api/application/triagem/lead-1/encaminhar?psi=psi-1&t=token-valido', {
      method: 'POST',
    });
    const params = Promise.resolve({ id: 'lead-404' });

    const response = await POST(request, { params });
    expect(response.status).toBe(404);
  });

  it('retorna 409 se o lead já foi confirmado ou já não pertence mais ao psicólogo', async () => {
    const request = new Request('http://localhost/api/application/triagem/lead-1/encaminhar?psi=psi-1&t=token-valido', {
      method: 'POST',
    });
    const params = Promise.resolve({ id: 'lead-conflito' });

    const response = await POST(request, { params });
    expect(response.status).toBe(409);
  });

  it('encaminha com sucesso e dispara WhatsApp e e-mail ao novo psicólogo', async () => {
    const request = new Request('http://localhost/api/application/triagem/lead-1/encaminhar?psi=psi-1&t=token-valido', {
      method: 'POST',
    });
    const params = Promise.resolve({ id: 'lead-1' });

    const response = await POST(request, { params });
    expect(response.status).toBe(200);
    const json = await response.json();
    expect(json.success).toBe(true);
    expect(json.situacao).toBe('encaminhado');

    expect(avisarTransbordoMock).toHaveBeenCalledWith(
      expect.objectContaining({ id: 'lead-1' }),
      expect.objectContaining({ id: 'psi-2' }),
      'Dr. Anterior',
      'encaminhamento_voluntario'
    );
    expect(avisarAlocacaoPsicologoPorEmailMock).toHaveBeenCalledWith(
      expect.objectContaining({ id: 'lead-1' }),
      expect.objectContaining({ id: 'psi-2' }),
      'RODIZIO'
    );
  });
});
