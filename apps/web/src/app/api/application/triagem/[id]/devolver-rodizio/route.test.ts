import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('server-only', () => ({}));

const mutateMock = vi.fn();
vi.mock('@/server/persistence/captureRepository', () => ({
  captureStateAsSnapshot: vi.fn((state) => state),
  getCaptureRepository: vi.fn(() => ({ mutate: mutateMock })),
}));

const exigirGestaoMock = vi.fn();
vi.mock('@/server/viverMaisGestaoAuth', () => {
  class NaoAutorizadoError extends Error {
    constructor(public status: number, message: string) { super(message); }
  }
  return { exigirGestao: () => exigirGestaoMock(), NaoAutorizadoError };
});

vi.mock('@/server/application/autorGestao', () => ({
  exigirGestaoComAutor: async () => {
    await exigirGestaoMock();
    return { sessao: { organizationId: 'org' }, autor: { usuarioRef: 'gestao-1' } };
  },
}));
const auditoriaMock = vi.fn();
vi.mock('@/server/application/auditoriaAlteracoes', () => ({ registrarAlteracao: (...args: unknown[]) => auditoriaMock(...args) }));

const avisarAlocacaoMock = vi.fn();
vi.mock('@/server/application/viverMaisWhatsApp', () => ({
  avisarAlocacao: (...args: unknown[]) => avisarAlocacaoMock(...args),
}));
const emailMock = vi.fn();
vi.mock('@/server/application/triagemEmail', () => ({
  avisarAlocacaoPsicologoPorEmail: (...args: unknown[]) => emailMock(...args),
}));

const devolverMock = vi.fn();
vi.mock('@/server/application/viverMaisRodizio', () => ({
  devolverAoRodizio: (...args: unknown[]) => devolverMock(...args),
}));

import { POST } from './route';
import { NaoAutorizadoError } from '@/server/viverMaisGestaoAuth';

const chamar = (id: string) => POST(new Request(`http://localhost/api/application/triagem/${id}/devolver-rodizio`, { method: 'POST' }), {
  params: Promise.resolve({ id }),
});

describe('POST /api/application/triagem/[id]/devolver-rodizio', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    exigirGestaoMock.mockResolvedValue(undefined);
    mutateMock.mockImplementation(async (callback) => callback({}).result);
  });

  it('exige sessão da gestão', async () => {
    exigirGestaoMock.mockRejectedValue(new NaoAutorizadoError(403, 'Restrito'));
    const resposta = await chamar('lead-1');
    expect(resposta.status).toBe(403);
    expect(devolverMock).not.toHaveBeenCalled();
  });

  it('avisa o profissional escolhido pelo rodízio', async () => {
    const lead = { id: 'lead-1', protocolo: 'VM-1' };
    const psicologo = { id: 'psi-2' };
    devolverMock.mockReturnValue({ situacao: 'alocado', snapshot: {}, lead, psicologo });
    const resposta = await chamar('lead-1');

    expect(await resposta.json()).toMatchObject({ success: true, situacao: 'alocado' });
    expect(avisarAlocacaoMock).toHaveBeenCalledWith(lead, psicologo);
    expect(emailMock).toHaveBeenCalledWith(lead, psicologo, 'RODIZIO');
  });

  it('sem candidato, informa a gestão e não envia aviso', async () => {
    devolverMock.mockReturnValue({ situacao: 'sem_candidato', snapshot: {} });
    const resposta = await chamar('lead-1');

    expect(await resposta.json()).toMatchObject({ success: true, situacao: 'sem_candidato' });
    expect(avisarAlocacaoMock).not.toHaveBeenCalled();
  });

  it('recusa caso que não aguarda decisão', async () => {
    devolverMock.mockReturnValue({ situacao: 'nao_aplicavel', snapshot: {} });
    expect((await chamar('lead-1')).status).toBe(409);
  });
});
