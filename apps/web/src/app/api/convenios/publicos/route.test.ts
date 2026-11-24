import { afterEach, expect, it, vi } from 'vitest';

vi.mock('server-only', () => ({}));
const query = vi.hoisted(() => vi.fn());
vi.mock('@/server/oci/runtime', () => ({ getMysqlPool: () => ({ query }) }));
import { GET } from './route';
import { instituicaoId } from '@/server/persistence/mysql/mappers';

afterEach(() => vi.unstubAllEnvs());

it('filtra os convênios ativos pela organização configurada no servidor', async () => {
  vi.stubEnv('ORGANIZATION_ID', 'org-ficticia');
  query.mockResolvedValue([[{ ref_core: 'conv-1', nome: 'Empresa fictícia' }]]);
  const response = await GET();
  expect(query).toHaveBeenCalledWith(expect.stringContaining('instituicao_id = ? AND organizacao_ref = ? AND ativo = 1'),
    [instituicaoId(), 'org-ficticia']);
  expect(await response.json()).toEqual({ convenios: [{ id: 'conv-1', nome: 'Empresa fictícia' }] });
});
