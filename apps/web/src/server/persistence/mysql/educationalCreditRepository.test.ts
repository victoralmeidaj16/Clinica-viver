import { expect, it, vi } from 'vitest';
import { lerCreditos } from './educationalCreditRepository';

vi.mock('server-only', () => ({}));
const { query } = vi.hoisted(() => ({ query: vi.fn() }));
vi.mock('@/server/oci/runtime', () => ({ getMysqlPool: () => ({ query }) }));
vi.mock('./mappers', async (load) => ({ ...await load<typeof import('./mappers')>(), instituicaoId: () => 'i' }));

it('restringe o extrato por organização, perfil e competência do evento', async () => {
  query.mockResolvedValue([[{ id: 'a', origem: 'payment', profissional_ref: 'pro', base_centavos: '4000',
    credito_centavos: '2800', competencia_em: '2026-11-01 03:00:00.000' }]]);
  expect(await lerCreditos('org', { professionalIds: ['pro'], startDate: '2026-11-01T03:00:00Z' }))
    .toMatchObject([{ id: 'a', professionalId: 'pro', baseCents: 4000, creditCents: 2800, occurredAt: '2026-11-01T03:00:00.000Z' }]);
  expect(query).toHaveBeenCalledWith(expect.stringMatching(/instituicao_id = .*organizacao_ref = .*profissional_ref IN .*competencia_em >= /),
    ['i', 'org', ['pro'], '2026-11-01 03:00:00.000']);
});
