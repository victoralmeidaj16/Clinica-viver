import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('server-only', () => ({}));
const mocks = vi.hoisted(() => ({ create: vi.fn(), send: vi.fn(), configured: vi.fn(), limited: vi.fn() }));
vi.mock('@/server/application/passwordReset', () => ({ createPsychologistPasswordReset: mocks.create }));
vi.mock('@/server/application/passwordResetEmail', () => ({ sendPasswordResetEmail: mocks.send, passwordResetEmailConfigured: mocks.configured }));
vi.mock('@/server/http/publicRequest', () => ({ rateLimited: mocks.limited }));
vi.mock('@/server/oci/runtime', () => ({ isMysqlConfigured: () => true }));

import { ApplicationError } from '@/server/application/http';
import { POST } from './route';

const request = (email: unknown = ' PSI@example.com ') => new Request('https://example.com/api/auth/solicitar-redefinicao', {
  method: 'POST', body: JSON.stringify({ email }),
});

describe('solicitação pública de recuperação', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    mocks.configured.mockReturnValue(true);
    mocks.create.mockResolvedValue({ token: 'segredo' });
    mocks.send.mockResolvedValue(undefined);
  });

  it('envia ao e-mail normalizado, sem devolver o token', async () => {
    const response = await POST(request());
    expect(response.status).toBe(200);
    expect(mocks.create).toHaveBeenCalledWith('psi@example.com', true);
    expect(mocks.send).toHaveBeenCalledWith('psi@example.com', 'segredo');
    expect(JSON.stringify(await response.json())).not.toContain('segredo');
  });

  it.each(['NOT_FOUND', 'RESET_COOLDOWN'])('não revela contas inexistentes ou tentativas repetidas: %s', async (code) => {
    const expected = await (await POST(request())).json();
    mocks.send.mockClear();
    mocks.create.mockRejectedValueOnce(new ApplicationError(code, 'privado', 404));
    const response = await POST(request());
    expect(response.status).toBe(200);
    expect((await response.json()).data).toEqual(expected.data);
    expect(mocks.send).not.toHaveBeenCalled();
  });

  it('não expõe falha do provedor nem dados internos', async () => {
    const log = vi.spyOn(console, 'error').mockImplementation(() => {});
    mocks.send.mockRejectedValueOnce(new Error('segredo psi@example.com'));
    const response = await POST(request());
    expect(response.status).toBe(200);
    expect(JSON.stringify(await response.json())).not.toContain('segredo');
    expect(JSON.stringify(log.mock.calls)).not.toContain('psi@example.com');
    log.mockRestore();
  });

  it.each(['inválido', '', null, 123])('rejeita e-mail inválido: %s', async (email) => {
    expect((await POST(request(email))).status).toBe(400);
    expect(mocks.create).not.toHaveBeenCalled();
  });

  it('limita abuso antes de consultar contas', async () => {
    mocks.limited.mockReturnValue(true);
    const response = await POST(request());
    expect(response.status).toBe(429);
    expect(response.headers.get('Retry-After')).toBe('600');
    expect(mocks.create).not.toHaveBeenCalled();
  });

  it('informa indisponibilidade quando o envio não está configurado', async () => {
    mocks.configured.mockReturnValue(false);
    expect((await POST(request())).status).toBe(503);
    expect(mocks.create).not.toHaveBeenCalled();
  });
});
