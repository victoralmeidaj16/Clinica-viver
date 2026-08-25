import { afterEach, describe, expect, it, vi } from 'vitest';

vi.mock('server-only', () => ({}));

import { proxyToPersistentBackend } from './persistentBackendProxy';

afterEach(() => {
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
});

describe('proxyToPersistentBackend', () => {
  it('não encaminha requisições executadas fora da Vercel', async () => {
    vi.stubEnv('VERCEL', '');

    const result = await proxyToPersistentBackend(
      new Request('http://localhost:3000/api/certificados')
    );

    expect(result).toBeNull();
  });

  it('encaminha método, rota, query, cabeçalhos e corpo para a VPS', async () => {
    vi.stubEnv('VERCEL', '1');
    vi.stubEnv('BACKEND_ORIGIN', 'https://backend.example.com/');
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      Response.json({ ok: true }, { status: 201 })
    );

    const result = await proxyToPersistentBackend(
      new Request('https://frontend.example.com/api/certificados?pin=123', {
        method: 'POST',
        headers: { 'content-type': 'application/json', 'x-admin-pin': '123' },
        body: JSON.stringify({ code: 'ABC12345' }),
      })
    );

    expect(fetchMock).toHaveBeenCalledOnce();
    const [destination, init] = fetchMock.mock.calls[0];
    expect(String(destination)).toBe('https://backend.example.com/api/certificados?pin=123');
    expect(init?.method).toBe('POST');
    expect(new Headers(init?.headers).get('x-admin-pin')).toBe('123');
    expect(new TextDecoder().decode(init?.body as ArrayBuffer)).toBe('{"code":"ABC12345"}');
    expect(result?.status).toBe(201);
    expect(await result?.json()).toEqual({ ok: true });
  });
});
