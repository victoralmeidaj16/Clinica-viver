import { describe, expect, it, vi } from 'vitest';
vi.mock('server-only', () => ({}));
vi.mock('@/server/oci/runtime', () => ({ isMysqlConfigured: () => true }));
vi.mock('@/server/persistence/mysql/mappers', () => ({ instituicaoId: () => 'inst', rowId: (_prefix: string, value: string) => value }));
vi.mock('./sefinNacional', () => ({ ambienteNfse: () => 'producao' }));
import { NfseRepository } from './nfseRepository';

describe('isolamento dos ambientes fiscais', () => {
  it('consulta a cobrança apenas no ambiente selecionado', async () => {
    const query = vi.fn().mockResolvedValue([[], []]);
    const repository = new NfseRepository({ query } as never);
    await repository.porCobranca('org', 'cobranca');
    expect(query.mock.calls[0][0]).toContain('AND ambiente = ?');
    expect(query.mock.calls[0][1]).toEqual(['inst', 'org', 'cobranca', 'producao']);
  });
});
