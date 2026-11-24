import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { expect, it, vi } from 'vitest';
import { registrarAlteracaoAgendamento, tabelaDeAlteracoesAusente, alteracoesDoAgendamento, alteracoesRecentesDoProfissional } from './agendamentoAlteracoesRepository';

vi.mock('server-only', () => ({}));
const { query } = vi.hoisted(() => ({ query: vi.fn() }));
vi.mock('@/server/oci/runtime', () => ({ getMysqlPool: () => ({ query }) }));
vi.mock('./mappers', async (original) => ({ ...await original<typeof import('./mappers')>(), instituicaoId: () => 'inst' }));

it('cria tabela idempotente com índices por agendamento e profissional', () => {
  const sql = readFileSync(resolve(process.cwd(), '../../infra/mysql/090_agendamentos_alteracoes.sql'), 'utf8');
  expect(sql).toContain('CREATE TABLE IF NOT EXISTS clinica_agendamentos_alteracoes');
  expect(sql).toMatch(/UNIQUE KEY \w+ \(instituicao_id, agendamento_id, alterado_em\)/);
  expect(sql).toMatch(/KEY \w+ \(instituicao_id, organizacao_ref, profissional_ref, alterado_em\)/);
});

it('persiste a autoria e as diferenças usando o executor da operação', async () => {
  const execute = vi.fn();
  const mudancas = [{ campo: 'formato' as const, rotulo: 'Formato', de: 'Presencial', para: 'On-line' }];
  const alteradoEm = new Date();
  await registrarAlteracaoAgendamento({ execute }, { organizacaoRef: 'org', agendamentoId: 'apt', profissionalRef: 'psi',
    usuarioRef: 'admin', nome: 'Gestão', alteradoEm, mudancas });
  expect(execute).toHaveBeenCalledWith(expect.stringContaining('INSERT INTO clinica_agendamentos_alteracoes'),
    [expect.any(String), 'inst', 'org', 'apt', 'psi', 'admin', 'Gestão', alteradoEm, JSON.stringify(mudancas)]);
  expect(tabelaDeAlteracoesAusente({ code: 'ER_NO_SUCH_TABLE' })).toBe(true);
  expect(tabelaDeAlteracoesAusente(new Error('falha'))).toBe(false);
});

it('restringe a consulta ao atendimento autorizado, ou ao profissional e período da sessão', async () => {
  query.mockResolvedValue([[]]);
  await alteracoesDoAgendamento('org', 'apt');
  expect(query).toHaveBeenLastCalledWith(expect.stringContaining('h.organizacao_ref = ?'), ['inst', 'org', 'apt', 'apt']);
  const desde = new Date();
  await alteracoesRecentesDoProfissional('org', 'psi', desde);
  expect(query).toHaveBeenLastCalledWith(expect.stringContaining('h.profissional_ref = ? AND h.alterado_em >= ?'), ['inst', 'org', 'psi', desde]);
});

it('permite abrir o histórico antes da migration', async () => {
  query.mockRejectedValueOnce({ code: 'ER_NO_SUCH_TABLE' });
  await expect(alteracoesDoAgendamento('org', 'apt')).resolves.toEqual([]);
});
