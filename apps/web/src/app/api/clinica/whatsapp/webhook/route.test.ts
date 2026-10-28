import { afterEach, beforeEach, expect, it, vi } from 'vitest';

const processReply = vi.hoisted(() => vi.fn());
vi.mock('@/server/application/viverMaisRespostaPsicologo', () => ({ processarRespostaDoPsicologo: processReply }));
import { POST } from './route';

beforeEach(() => {
  vi.stubEnv('EVOLUTION_WEBHOOK_TOKEN', 'token-ficticio');
  processReply.mockReset().mockResolvedValue({ situacao: 'contato_confirmado' });
});
afterEach(() => vi.unstubAllEnvs());

function request(id: string | undefined, token = 'token-ficticio') {
  return new Request('https://example.invalid/webhook', { method: 'POST',
    headers: { 'x-evolution-token': token }, body: JSON.stringify({ event: 'messages.upsert',
      data: { key: { id, remoteJid: '5511999999999@s.whatsapp.net' }, message: { conversation: 'CONFIRMAR' } } }),
  });
}

it('encaminha o identificador estável do provedor junto com a resposta', async () => {
  expect((await POST(request('evento-ficticio'))).status).toBe(200);
  expect(processReply).toHaveBeenCalledExactlyOnceWith('5511999999999', 'CONFIRMAR', 'evento-ficticio');
});

it.each([undefined, '', '   '])('ignora mensagem sem identificador estável: %s', async (id) => {
  const response = await POST(request(id));
  expect(await response.json()).toMatchObject({ ignorado: 'evento_sem_uso' });
  expect(processReply).not.toHaveBeenCalled();
});

it('não processa evento não autenticado', async () => {
  expect((await POST(request('evento-ficticio', 'outro-token'))).status).toBe(401);
  expect(processReply).not.toHaveBeenCalled();
});

it('permite nova tentativa do mesmo evento após falha de persistência', async () => {
  processReply.mockRejectedValueOnce(new Error('Falha simulada.'));
  expect((await POST(request('evento-ficticio'))).status).toBe(500);
  expect((await POST(request('evento-ficticio'))).status).toBe(200);
  expect(processReply.mock.calls).toEqual([
    ['5511999999999', 'CONFIRMAR', 'evento-ficticio'],
    ['5511999999999', 'CONFIRMAR', 'evento-ficticio'],
  ]);
});
