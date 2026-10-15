import { afterEach, describe, expect, it, vi } from 'vitest';
vi.mock('server-only', () => ({}));
import { passwordResetEmailConfigured, sendPasswordResetEmail } from './passwordResetEmail';

afterEach(() => { vi.unstubAllGlobals(); vi.unstubAllEnvs(); });

describe('e-mail de recuperação', () => {
  it('envia link público com token e orientações de validade', async () => {
    vi.stubEnv('RESEND_API_KEY', 'teste');
    vi.stubEnv('NEXT_PUBLIC_APP_URL', 'https://clinicavivermais.cloud');
    const fetch = vi.fn().mockResolvedValue(new Response('{}', { status: 200 }));
    vi.stubGlobal('fetch', fetch);
    await sendPasswordResetEmail('psi@example.com', 'token-teste');
    const body = JSON.parse(fetch.mock.calls[0][1].body);
    expect(body.to).toEqual(['psi@example.com']);
    expect(body.text).toContain('https://clinicavivermais.cloud/redefinir-senha?token=token-teste');
    expect(body.html).toContain('Redefinir minha senha');
    expect(body.text).toContain('duas horas');
    expect(body.text).toContain('ignore este e-mail');
    expect(fetch.mock.calls[0][1].headers['Idempotency-Key']).not.toContain('token-teste');
  });

  it('detecta configuração ausente e rejeição do provedor', async () => {
    vi.stubEnv('RESEND_API_KEY', '');
    expect(passwordResetEmailConfigured()).toBe(false);
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response('privado', { status: 403 })));
    await expect(sendPasswordResetEmail('psi@example.com', 'token')).rejects.toThrow('PASSWORD_RESET_EMAIL_HTTP_403');
  });
});
