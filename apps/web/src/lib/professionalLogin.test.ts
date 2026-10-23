import { afterEach, describe, expect, it, vi } from 'vitest';
import { professionalLogin } from './professionalLogin';

const unavailable = 'A plataforma está temporariamente indisponível. Tente novamente em alguns minutos.';
const credentials = { email: 'profissional@example.test', password: 'senha-ficticia' };

afterEach(() => vi.unstubAllGlobals());

describe('professionalLogin', () => {
  it.each([
    new Response('An error occurred with this application.', { status: 502 }),
    new Response('<html>Unavailable</html>', { status: 503 }),
    new Response('{invalid', { headers: { 'Content-Type': 'application/json' } }),
    Response.json(null),
  ])('mostra mensagem compreensível para resposta inválida ou indisponível', async (response) => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(response));
    await expect(professionalLogin(credentials)).rejects.toThrow(unavailable);
  });

  it('preserva o aviso de credenciais inválidas', async () => {
    const fetchMock = vi.fn().mockResolvedValue(Response.json({
      ok: false, error: { message: 'E-mail ou senha inválidos.' },
    }, { status: 401 }));
    vi.stubGlobal('fetch', fetchMock);
    await expect(professionalLogin(credentials)).rejects.toThrow('E-mail ou senha inválidos.');
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('orienta o usuário quando não consegue conectar', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new TypeError('Failed to fetch')));
    await expect(professionalLogin(credentials)).rejects.toThrow(
      'Não foi possível conectar à plataforma. Verifique sua conexão e tente novamente.',
    );
  });

  it('trata indisponibilidade na consulta de sessão após autenticar', async () => {
    vi.stubGlobal('fetch', vi.fn()
      .mockResolvedValueOnce(Response.json({ ok: true }))
      .mockResolvedValueOnce(new Response('An error occurred', { status: 502 })));
    await expect(professionalLogin(credentials)).rejects.toThrow(unavailable);
  });

  it.each(['admin', 'psicologo'] as const)('retorna o perfil %s apenas após confirmar a sessão', async (role) => {
    vi.stubGlobal('fetch', vi.fn()
      .mockResolvedValueOnce(Response.json({ ok: true }))
      .mockResolvedValueOnce(Response.json({ ok: true, data: { role } })));
    await expect(professionalLogin(credentials)).resolves.toBe(role);
  });
});
