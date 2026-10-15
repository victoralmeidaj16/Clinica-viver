import { renderToStaticMarkup } from 'react-dom/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const navigation = vi.hoisted(() => ({ token: '' }));
vi.mock('next/navigation', () => ({
  useRouter: () => ({ replace: vi.fn() }),
  useSearchParams: () => new URLSearchParams(navigation.token ? { token: navigation.token } : {}),
}));
import Page from './page';

describe('entrada da recuperação de senha', () => {
  beforeEach(() => { navigation.token = ''; });

  it('abre solicitação por e-mail quando acessada pelo login sem token', () => {
    const html = renderToStaticMarkup(<Page />);
    expect(html).toContain('type="email"');
    expect(html).toContain('Enviar link de recuperação');
    expect(html).not.toContain('type="password"');
    expect(html).not.toContain('disabled=""');
    expect(html).toContain('href="/login"');
  });

  it('abre nova senha para um link recebido e permite pedir outro link', () => {
    navigation.token = 'token-recebido';
    const html = renderToStaticMarkup(<Page />);
    expect(html).toContain('Confirmar nova senha');
    expect(html).toContain('Salvar senha e acessar');
    expect(html).not.toContain('type="email"');
    expect(html).toContain('Solicitar um novo link de recuperação');
    expect(html).not.toContain('token-recebido');
  });
});
