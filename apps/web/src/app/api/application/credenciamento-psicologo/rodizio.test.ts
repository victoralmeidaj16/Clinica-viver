import { beforeEach, describe, expect, it, vi } from 'vitest';
vi.mock('server-only', () => ({}));
const mocks = vi.hoisted(() => ({ read: vi.fn(), readSession: vi.fn() }));
vi.mock('@/server/auth', () => ({ readSession: mocks.readSession }));
vi.mock('@/server/oci/runtime', () => ({ isMysqlConfigured: () => false, getMysqlPool: vi.fn() }));
vi.mock('@/server/persistence/captureRepository', () => ({ getCaptureRepository: () => ({ read: mocks.read }) }));
import { GET } from './route';

describe('consulta do rodízio pela gestão', () => {
  beforeEach(() => vi.resetAllMocks());

  it.each([null, { role: 'psychologist' }])('não consulta a fila sem sessão de admin: %j', async (sessao) => {
    mocks.readSession.mockResolvedValue(sessao);
    const resposta = await GET();
    expect(resposta.status).toBe(sessao ? 403 : 401);
    expect(mocks.read).not.toHaveBeenCalled();
  });

  it('inclui posição e total calculados sem reordenar os cadastros', async () => {
    mocks.readSession.mockResolvedValue({ role: 'admin' });
    const base = { nomeCompleto: 'Profissional fictício', crp: '00/00000', whatsapp: '', status: 'APROVADO',
      criadoEm: '2026-01-01T00:00:00Z', turnosDisponiveis: ['MANHA'], modalidadesAtendidas: ['PARTICULAR'] };
    mocks.read.mockResolvedValue({ cadastrosPsicologos: [
      { ...base, id: 'recente', ultimoLeadRecebidoEm: '2026-11-01T00:00:00Z' },
      { ...base, id: 'novo' },
      { ...base, id: 'pausado', pausadoNoRodizio: true },
    ] });
    const resposta = await GET();
    expect(resposta.status).toBe(200);
    const { data } = await resposta.json();
    expect(data.map(({ id, rodizio }: { id: string; rodizio: unknown }) => ({ id, rodizio }))).toEqual([
      { id: 'recente', rodizio: { posicao: 2, total: 2 } },
      { id: 'novo', rodizio: { posicao: 1, total: 2 } },
      { id: 'pausado', rodizio: { posicao: null, total: 2, motivo: 'Pausado pela gestão' } },
    ]);
  });
});
