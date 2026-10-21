import { beforeEach, describe, expect, it, vi } from 'vitest';
vi.mock('server-only', () => ({}));
const state = vi.hoisted(() => ({ derivadas: vi.fn(), lidas: vi.fn(), marcar: vi.fn() }));
vi.mock('@/server/auth', () => ({ readSession: async () => ({ userId: 'usr', role: 'psychologist', organizationId: 'org' }) }));
vi.mock('@/server/application/notificacoesDaSessao', () => ({ notificacoesDaSessao: state.derivadas }));
vi.mock('@/server/persistence/notificacoesLeituras', () => ({
  getLeiturasRepository: () => ({ lidas: state.lidas, marcar: state.marcar }),
}));
import { POST } from './route';

const agendamento = {
  chave: 'agenda:appointment', tipo: 'AGENDAMENTO', titulo: 'Sessão marcada', descricao: '',
  ocorridoEm: new Date().toISOString(), severidade: 'INFO', href: '/agenda', pendente: false,
};

beforeEach(() => {
  vi.resetAllMocks();
  state.derivadas.mockResolvedValue([agendamento]);
  state.lidas.mockResolvedValue(new Set());
});

describe('marcar notificações como lidas', () => {
  it('"marcar todas" grava também os avisos de agenda que o sino mostra', async () => {
    const resposta = await POST(new Request('http://x/api', { method: 'POST', body: JSON.stringify({ todas: true }) }));
    expect(resposta.status).toBe(200);
    expect(state.marcar).toHaveBeenCalledWith('usr', ['agenda:appointment']);
    expect((await resposta.json()).data.naoLidas).toBe(0);
  });
});
