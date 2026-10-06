import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('server-only', () => ({}));

const state = vi.hoisted(() => ({
  encerrar: vi.fn(),
  reabrir: vi.fn(),
  listar: vi.fn(),
  migrarLegadas: vi.fn(),
}));

vi.mock('@/server/auth', () => ({
  readSession: async () => ({ userId: 'admin-test' }),
}));
vi.mock('@/server/viverMaisGestaoAuth', () => ({
  exigirGestao: async () => {},
  NaoAutorizadoError: class extends Error { readonly status = 401; },
}));
vi.mock('@/server/persistence/turmasEncerradas', () => ({
  getTurmasEncerradasRepository: () => state,
  MigracaoTurmasPendenteError: class extends Error {
    readonly status = 503;
    constructor() {
      super('Migração pendente');
    }
  },
}));

import { DELETE, POST } from './route';
import { MigracaoTurmasPendenteError } from '@/server/persistence/turmasEncerradas';

const curso = 'Formação e Pós-graduação em Psicodrama';

function post(body: unknown) {
  return POST(new Request('http://localhost/api/application/turmas-encerradas', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  }));
}

beforeEach(() => {
  vi.resetAllMocks();
  state.listar.mockResolvedValue([]);
  state.encerrar.mockResolvedValue(undefined);
  state.reabrir.mockResolvedValue(undefined);
});

describe('API de turmas por pós-graduação', () => {
  it('encerra a identidade normalizada e registra o responsável', async () => {
    const response = await post({ turma: ' 25a ', posGraduacao: ` ${curso} ` });

    expect(response.status).toBe(200);
    expect(state.encerrar).toHaveBeenCalledWith(
      { turma: '25A', posGraduacao: curso },
      'admin-test'
    );
  });

  it('reabre usando os dois parâmetros da identidade', async () => {
    const query = new URLSearchParams({ turma: '25A', posGraduacao: curso });
    const response = await DELETE(new Request(
      `http://localhost/api/application/turmas-encerradas?${query}`,
      { method: 'DELETE' }
    ));

    expect(response.status).toBe(200);
    expect(state.reabrir).toHaveBeenCalledWith({ turma: '25A', posGraduacao: curso });
  });

  it.each([
    [{ turma: '25A', posGraduacao: '' }, 'Pós-graduação inválida'],
    [{ turma: '25A', posGraduacao: 'Curso inventado' }, 'Pós-graduação inválida'],
    [{ turma: '99Z', posGraduacao: curso }, 'Turma inválida'],
  ])('recusa entrada inválida %#', async (body, mensagem) => {
    const response = await post(body);

    expect(response.status).toBe(400);
    expect((await response.json()).error).toContain(mensagem);
    expect(state.encerrar).not.toHaveBeenCalled();
  });

  it('responde 503 quando falta a migração', async () => {
    state.encerrar.mockRejectedValueOnce(new MigracaoTurmasPendenteError());

    const response = await post({ turma: '25A', posGraduacao: curso });

    expect(response.status).toBe(503);
  });

  it('não vaza detalhes de erro inesperado', async () => {
    state.encerrar.mockRejectedValueOnce(new Error('segredo interno'));
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {});

    const response = await post({ turma: '25A', posGraduacao: curso });

    expect(response.status).toBe(500);
    expect(await response.json()).toEqual({ success: false, error: 'Falha ao atualizar as turmas.' });
    consoleError.mockRestore();
  });
});
