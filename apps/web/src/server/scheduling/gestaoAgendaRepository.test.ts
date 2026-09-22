import { beforeEach, expect, it, vi } from 'vitest';
vi.mock('server-only', () => ({}));
const { query } = vi.hoisted(() => ({ query: vi.fn<(...args: unknown[]) => Promise<unknown[][]>>(async () => [[], []]) }));
vi.mock('@/server/oci/runtime', () => ({ getMysqlPool: () => ({ query }) }));
vi.mock('@/server/persistence/mysql/mappers', () => ({ instituicaoId: () => 'inst' }));
import { listarAgendaGestao, profissionalDoAgendamentoGestao } from './gestaoAgendaRepository';
beforeEach(() => vi.clearAllMocks());
it('limita sessões à organização e aos estados editáveis com paginação', async () => {
  await expect(listarAgendaGestao('org', 'Maria', 2)).resolves.toEqual({ appointments: [], temMais: false });
  const [sql, values] = query.mock.calls[0] as [string, unknown[]];
  expect(sql).toContain("a.status IN ('agendado', 'confirmado')");
  expect(sql).toContain('a.instituicao_id = ? AND o.ref_core = ?');
  expect(sql).toContain('LIMIT 51 OFFSET ?');
  expect(values).toEqual(['inst', 'org', '%Maria%', '%Maria%', 100]);
});
it('resolve profissional somente dentro da organização autenticada', async () => {
  await expect(profissionalDoAgendamentoGestao('org', 'appt')).resolves.toBeNull();
  const [sql, values] = query.mock.calls[0] as [string, unknown[]];
  expect(sql).toContain('o.id = a.organizacao_id');
  expect(sql).toContain('a.instituicao_id = ? AND o.ref_core = ? AND (a.id = ? OR a.ref_core = ?)');
  expect(values).toEqual(['inst', 'org', 'appt', 'appt']);
});
