import { beforeEach, expect, it, vi } from 'vitest';
import { ApplicationError } from '@/server/application/http';

vi.mock('server-only', () => ({}));
const mocks = vi.hoisted(() => ({ activate: vi.fn(), startSession: vi.fn() }));
vi.mock('@/server/application/psychologistAccess', () => ({ activatePsychologistAccount: mocks.activate }));
vi.mock('@/server/auth', () => ({ startSession: mocks.startSession }));
import { POST } from './route';

const request = () => new Request('http://localhost/api/auth/ativar-conta', {
  method: 'POST', body: JSON.stringify({ token: 'convite', password: 'senha-forte-123' }),
});
beforeEach(() => { vi.clearAllMocks(); vi.spyOn(console, 'error').mockImplementation(() => {}); });

it('devolve ao navegador a recusa prevista', async () => {
  mocks.activate.mockRejectedValue(new ApplicationError('INVALID_INVITE', 'Este link é inválido, já foi utilizado ou expirou.', 400));
  const response = await POST(request());
  expect(response.status).toBe(400);
  expect((await response.json()).error.message).toBe('Este link é inválido, já foi utilizado ou expirou.');
});

it('não expõe o erro interno do banco', async () => {
  mocks.activate.mockRejectedValue(new Error("ER_NO_SUCH_TABLE: Table 'clinica_convites_acesso' doesn't exist"));
  const response = await POST(request());
  expect(response.status).toBe(500);
  expect(console.error).toHaveBeenCalledWith('[ativar-conta] Falha ao ativar a conta.');
  expect(JSON.stringify(await response.json())).not.toContain('ER_NO_SUCH_TABLE');
});
