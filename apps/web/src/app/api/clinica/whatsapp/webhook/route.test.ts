import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { POST } from './route';

beforeEach(() => vi.stubEnv('EVOLUTION_WEBHOOK_TOKEN', 'token-ficticio'));
afterEach(() => vi.unstubAllEnvs());

function request(texto: string, token = 'token-ficticio') {
  return new Request('https://example.invalid/webhook', { method: 'POST',
    headers: { 'x-evolution-token': token }, body: JSON.stringify({ event: 'messages.upsert',
      data: { key: { id: 'evento-ficticio', remoteJid: '5511999999999@s.whatsapp.net' }, message: { conversation: texto } } }),
  });
}

it.each(['CONFIRMAR', 'ENCAMINHAR', 'Olá, tudo bem? Em que posso ajudar?'])(
  'não interpreta texto do psicólogo: a decisão é só pelo link (%s)', async (texto) => {
    const response = await POST(request(texto));
    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({ ignorado: 'decisao_somente_pelo_link' });
  },
);

it('recusa evento não autenticado', async () => {
  expect((await POST(request('CONFIRMAR', 'outro-token'))).status).toBe(401);
});
