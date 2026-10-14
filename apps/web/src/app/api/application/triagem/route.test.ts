import { beforeEach, describe, expect, it, vi } from 'vitest';
import { POST } from './route';

vi.mock('server-only', () => ({}));
const mocks = vi.hoisted(() => ({ mutate: vi.fn(), recebimento: vi.fn(), alocacao: vi.fn() }));
vi.mock('@/server/persistence/captureRepository', () => ({
  getCaptureRepository: () => ({ mutate: mocks.mutate }),
  captureStateAsSnapshot: (state: unknown) => state,
}));
vi.mock('@/server/application/viverMaisWhatsApp', () => ({
  avisarRecebimentoPaciente: mocks.recebimento, avisarAlocacao: mocks.alocacao, avisarTransbordo: vi.fn(),
}));
vi.mock('@/server/application/triagemEmail', () => ({
  avisarTriagemRecebidaPorEmail: vi.fn(), avisarAlocacaoPsicologoPorEmail: vi.fn(),
}));
vi.mock('@/server/viverMaisGestaoAuth', () => ({ ehGestao: async () => false }));
vi.mock('@/server/http/publicRequest', () => ({ rateLimited: () => false }));
vi.mock('@/lib/triagemSubmissao', () => ({
  LIMITE_CORPO_BYTES: 10000,
  validarSubmissaoTriagem: () => ({ ok: true, dados: { nome: 'Maria', telefone: '11987654321' } }),
}));

const lead = { id: 'lead-1', protocolo: 'VM-123456' };
function solicitar() {
  return POST(new Request('http://localhost/api/application/triagem', { method: 'POST', body: '{}' }));
}

beforeEach(() => vi.clearAllMocks());
describe('acolhimento na solicitação de agendamento', () => {
  it.each([undefined, { id: 'psi-1' }])('envia ao paciente com profissional %j', async (psicologo) => {
    mocks.mutate.mockResolvedValue({ situacao: 'criado', lead, psicologo });
    expect((await solicitar()).status).toBe(200);
    expect(mocks.recebimento).toHaveBeenCalledExactlyOnceWith(lead);
    expect(mocks.alocacao).toHaveBeenCalledTimes(psicologo ? 1 : 0);
  });

  it('não repete o acolhimento em submissão duplicada', async () => {
    mocks.mutate.mockResolvedValue({ situacao: 'reenvio', lead });
    expect((await solicitar()).status).toBe(200);
    expect(mocks.recebimento).not.toHaveBeenCalled();
  });
});
