import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const database = vi.hoisted(() => ({
  rows: new Map<string, { conteudo_hash: string; tentativa: string; estado: string; provedor_ref?: string | null }>(),
  failReserve: false,
  failFinish: false,
}));
vi.mock('server-only', () => ({}));
vi.mock('@/server/persistence/mysql/mappers', () => ({ instituicaoId: () => 'institution' }));
vi.mock('@/server/oci/runtime', () => ({
  isMysqlConfigured: () => true,
  getMysqlPool: () => ({
    // Model each SQL statement atomically, preserving rows across module reloads.
    execute: async (sql: string, values: string[]) => {
      if (sql.includes('INSERT IGNORE')) {
        if (database.failReserve) throw new Error('database unavailable');
        const [, key, fingerprint, attempt] = values;
        if (!database.rows.has(key)) database.rows.set(key, { conteudo_hash: fingerprint, tentativa: attempt, estado: 'sending' });
        return [{ affectedRows: 1 }];
      }
      if (sql.includes('SET tentativa')) {
        const [attempt, , key, fingerprint] = values;
        const row = database.rows.get(key);
        if (row?.estado !== 'rejected' || row.conteudo_hash !== fingerprint) return [{ affectedRows: 0 }];
        Object.assign(row, { tentativa: attempt, estado: 'sending' });
        return [{ affectedRows: 1 }];
      }
      if (database.failFinish) throw new Error('completion write unavailable');
      const [state, provider, , key, attempt] = values;
      const row = database.rows.get(key);
      if (row?.tentativa !== attempt || row.estado !== 'sending') return [{ affectedRows: 0 }];
      Object.assign(row, { estado: state, provedor_ref: provider });
      return [{ affectedRows: 1 }];
    },
    query: async (_sql: string, values: string[]) => {
      const row = database.rows.get(values[1]);
      return [row ? [{ ...row }] : []];
    },
  }),
}));

const input = {
  scope: 'organization:user', key: 'request-one', number: '5511999999999', text: 'Olá',
  config: { url: 'https://provider.invalid', apiKey: 'test', instancia: 'test' },
};
const successful = () => new Response(JSON.stringify({ key: { id: 'provider-1' } }), { status: 200 });

beforeEach(() => {
  vi.resetModules();
  database.rows.clear();
  database.failReserve = false;
  database.failFinish = false;
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue(successful()));
});
afterEach(() => vi.unstubAllGlobals());

describe('durable WhatsApp delivery', () => {
  it('coalesces concurrent same-key calls into a single provider request', async () => {
    const { deliverWhatsApp } = await import('./whatsappDelivery');
    const results = await Promise.all(Array.from({ length: 8 }, () => deliverWhatsApp(input)));
    expect(fetch).toHaveBeenCalledTimes(1);
    expect(results.every((result) => result.state === 'sent')).toBe(true);
  });

  it('shares the durable reservation across separately loaded workers', async () => {
    const workerA = await import('./whatsappDelivery');
    vi.resetModules();
    const workerB = await import('./whatsappDelivery');
    const results = await Promise.all([workerA.deliverWhatsApp(input), workerB.deliverWhatsApp(input)]);
    expect(fetch).toHaveBeenCalledTimes(1);
    expect(results.map((result) => result.state)).toContain('sent');
    expect(results.every((result) => ['sent', 'sending'].includes(result.state))).toBe(true);
  });

  it('returns the persisted sent result after a module reload without resending', async () => {
    await (await import('./whatsappDelivery')).deliverWhatsApp(input);
    vi.resetModules();
    expect(await (await import('./whatsappDelivery')).deliverWhatsApp(input))
      .toEqual({ state: 'sent', providerMessageId: 'provider-1' });
    expect(fetch).toHaveBeenCalledTimes(1);
  });

  it('rejects reuse for different content after reload', async () => {
    await (await import('./whatsappDelivery')).deliverWhatsApp(input);
    vi.resetModules();
    expect(await (await import('./whatsappDelivery')).deliverWhatsApp({ ...input, text: 'Outro conteúdo' }))
      .toEqual({ state: 'conflict' });
    expect(fetch).toHaveBeenCalledTimes(1);
  });

  it('does not retry a timeout even after reload', async () => {
    vi.mocked(fetch).mockRejectedValueOnce(new DOMException('Timed out', 'TimeoutError'));
    expect((await (await import('./whatsappDelivery')).deliverWhatsApp(input)).state).toBe('unknown');
    vi.resetModules();
    expect((await (await import('./whatsappDelivery')).deliverWhatsApp(input)).state).toBe('unknown');
    expect(fetch).toHaveBeenCalledTimes(1);
  });

  it('allows a safe explicit rejection to be retried under the same key', async () => {
    vi.mocked(fetch).mockResolvedValueOnce(new Response('{}', { status: 400 }));
    expect((await (await import('./whatsappDelivery')).deliverWhatsApp(input)).state).toBe('rejected');
    vi.resetModules();
    expect((await (await import('./whatsappDelivery')).deliverWhatsApp(input)).state).toBe('sent');
    expect(fetch).toHaveBeenCalledTimes(2);
  });

  it('never contacts the provider when reservation fails', async () => {
    database.failReserve = true;
    await expect((await import('./whatsappDelivery')).deliverWhatsApp(input)).rejects.toThrow('database unavailable');
    expect(fetch).not.toHaveBeenCalled();
  });

  it('preserves sending after completion persistence fails, preventing blind retry', async () => {
    database.failFinish = true;
    await expect((await import('./whatsappDelivery')).deliverWhatsApp(input)).rejects.toThrow('completion write unavailable');
    database.failFinish = false;
    vi.resetModules();
    expect((await (await import('./whatsappDelivery')).deliverWhatsApp(input)).state).toBe('sending');
    expect(fetch).toHaveBeenCalledTimes(1);
  });

  it('rejects a stale attempt completing a newer reservation', async () => {
    const repository = await import('./whatsappDeliveryRepository');
    const first = await repository.reserveDelivery('key', 'fingerprint');
    await repository.finishDelivery(first, 'rejected');
    const second = await repository.reserveDelivery('key', 'fingerprint');
    expect(second.acquired).toBe(true);
    await expect(repository.finishDelivery(first, 'sent', 'stale')).rejects.toThrow();
    await repository.finishDelivery(second, 'sent', 'current');
    expect((await repository.reserveDelivery('key', 'fingerprint')).providerMessageId).toBe('current');
  });
});

it.each([408, 499, 500])('não repete uma resposta HTTP ambígua %s', async (status) => {
  vi.mocked(fetch).mockResolvedValueOnce(new Response('{}', { status }));
  const { deliverWhatsApp } = await import('./whatsappDelivery');
  expect((await deliverWhatsApp(input)).state).toBe('unknown');
  vi.resetModules();
  expect((await (await import('./whatsappDelivery')).deliverWhatsApp(input)).state).toBe('unknown');
  expect(fetch).toHaveBeenCalledTimes(1);
});
