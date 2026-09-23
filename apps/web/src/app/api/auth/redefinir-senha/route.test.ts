import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('server-only', () => ({}));

const { resetPsychologistPassword, startSession } = vi.hoisted(() => ({
  resetPsychologistPassword: vi.fn(),
  startSession: vi.fn(async () => {}),
}));

vi.mock('@/server/application/passwordReset', () => ({ resetPsychologistPassword }));
vi.mock('@/server/auth', () => ({ startSession }));
vi.mock('@/server/oci/runtime', () => ({ isMysqlConfigured: () => true }));

import { ApplicationError } from '@/server/application/http';
import { POST } from './route';

function pedido() {
  return new Request('http://localhost/api/auth/redefinir-senha', {
    method: 'POST',
    body: JSON.stringify({ token: 'abc', password: 'senhaForte123' }),
  });
}

describe('POST /api/auth/redefinir-senha', () => {
  beforeEach(() => vi.clearAllMocks());

  it('repassa a recusa prevista com a mensagem para o usuário', async () => {
    resetPsychologistPassword.mockRejectedValueOnce(
      new ApplicationError('INVALID_RESET_TOKEN', 'Este link é inválido, já foi utilizado ou expirou.', 400)
    );
    const res = await POST(pedido());
    expect(res.status).toBe(400);
    expect((await res.json()).error).toEqual({
      code: 'INVALID_RESET_TOKEN',
      message: 'Este link é inválido, já foi utilizado ou expirou.',
    });
    expect(startSession).not.toHaveBeenCalled();
  });

  it('não expõe o detalhe de uma falha interna', async () => {
    const log = vi.spyOn(console, 'error').mockImplementation(() => {});
    resetPsychologistPassword.mockRejectedValueOnce(
      new Error("ER_NO_SUCH_TABLE: Table 'clinica.clinica_redefinicoes_senha' doesn't exist")
    );
    const res = await POST(pedido());
    const body = await res.json();
    expect(res.status).toBe(500);
    expect(body.error.code).toBe('PASSWORD_RESET_FAILED');
    expect(body.error.message).not.toContain('ER_NO_SUCH_TABLE');
    expect(log).toHaveBeenCalled();
    log.mockRestore();
  });
});
