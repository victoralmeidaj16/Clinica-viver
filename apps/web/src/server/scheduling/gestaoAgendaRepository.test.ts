import { beforeEach, expect, it, vi } from 'vitest';
vi.mock('server-only', () => ({}));
const { query } = vi.hoisted(() => ({ query: vi.fn<(...args: unknown[]) => Promise<unknown[][]>>(async () => [[], []]) }));
vi.mock('@/server/oci/runtime', () => ({ getMysqlPool: () => ({ query }) }));
vi.mock('@/server/persistence/mysql/mappers', async (original) => ({
  ...await original<typeof import('@/server/persistence/mysql/mappers')>(), instituicaoId: () => 'inst',
}));
import { listarAgendaGestao, profissionalDoAgendamentoGestao, convenioDoAgendamentoGestao } from './gestaoAgendaRepository';
beforeEach(() => vi.clearAllMocks());
it('limita sessões à organização e aos estados editáveis com paginação', async () => {
  await expect(listarAgendaGestao('org', 'Maria', 2)).resolves.toEqual({ appointments: [], temMais: false });
  const [sql, values] = query.mock.calls[0] as [string, unknown[]];
  expect(sql).toContain("a.status IN ('agendado', 'confirmado')");
  expect(sql).toContain('a.instituicao_id = ? AND o.ref_core = ?');
  expect(sql).toContain('LIMIT 51 OFFSET ?');
  expect(sql).toMatch(/ORDER BY a\.fim < UTC_TIMESTAMP\(3\),\s+CASE WHEN a\.fim >= UTC_TIMESTAMP\(3\) THEN a\.inicio END,\s+a\.inicio DESC, a\.id/);
  expect(values).toEqual(['inst', 'org', '%Maria%', '%Maria%', 100]);
});
it('resolve profissional somente dentro da organização autenticada', async () => {
  await expect(profissionalDoAgendamentoGestao('org', 'appt')).resolves.toBeNull();
  const [sql, values] = query.mock.calls[0] as [string, unknown[]];
  expect(sql).toContain('o.id = a.organizacao_id');
  expect(sql).toContain('a.instituicao_id = ? AND o.ref_core = ? AND (a.id = ? OR a.ref_core = ?)');
  expect(values).toEqual(['inst', 'org', 'appt', 'appt']);
});

it('devolve o vencimento em UTC, o pagamento e a cota para a edição', async () => {
  query.mockResolvedValueOnce([[{ id: 'apt', versao: 1, inicio: '2099-01-01 15:00:00.000', fim: '2099-01-01 15:50:00.000',
    paciente_nome: 'Paciente fictício', profissional_nome: 'Profissional fictício', modalidade: 'online', status: 'agendado',
    convenio_nome: 'Empresa fictícia', custeado: 0, custeio_sessoes_cota: 4, custeio_sessoes_ciclo: 'mensal',
    vencimento_cobranca_em: '2099-01-02 22:00:00.000', pagamento_status: 'pending', pacote_sessoes: null }], []]);
  const { appointments } = await listarAgendaGestao('org', '', 0);
  expect(appointments[0]).toMatchObject({ inicio: '2099-01-01T15:00:00.000Z',
    vencimentoCobrancaEm: '2099-01-02T22:00:00.000Z', pagamentoStatus: 'pending', custeioCota: 4, custeioCiclo: 'mensal' });
});

it('resolve vínculo mensal somente dentro da organização autenticada', async () => {
  await expect(convenioDoAgendamentoGestao('org', 'apt')).resolves.toBeNull();
  const [sql, values] = query.mock.calls[0] as [string, unknown[]];
  expect(sql).toContain('a.instituicao_id = ? AND o.ref_core = ?');
  expect(values).toEqual(['inst', 'org', 'apt', 'apt']);
});
