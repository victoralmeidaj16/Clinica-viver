import { beforeEach, expect, it, vi } from 'vitest';
vi.mock('server-only', () => ({}));
const state = vi.hoisted(() => ({
  appointment: true, charges: [] as Record<string, unknown>[], coverage: [] as Record<string, unknown>[],
  queries: [] as Array<{ sql: string; values: unknown[] }>, inserted: [] as unknown[][],
  connection: { beginTransaction: vi.fn(), commit: vi.fn(), rollback: vi.fn(), release: vi.fn(), query: vi.fn(), execute: vi.fn() },
}));
vi.mock('@/server/oci/runtime', () => ({ getMysqlPool: () => ({ getConnection: async () => state.connection }) }));
vi.mock('@/server/persistence/mysql/mappers', () => ({ instituicaoId: () => 'inst', toSqlTimestamp: (value: string) => value }));
vi.mock('./sessionChargeDueWorker', () => ({ processAppointmentChargeDue: vi.fn(async () => 'updated') }));
import { atualizarVencimentoPorCobranca } from './chargeDueByCharge';
import { processAppointmentChargeDue } from './sessionChargeDueWorker';
const input = { organizationId: 'org', chargeId: 'charge', dueAt: '2099-01-01T12:00:00Z' };

beforeEach(() => {
  vi.clearAllMocks();
  state.appointment = true; state.queries = []; state.inserted = []; state.coverage = [{ custeado: 0, fatura_convenio_ref: null }];
  state.charges = [{ id: 'charge-row', ref_core: 'charge', organizacao_ref: 'org', status: 'overdue', possui_pagamento: 0 }];
  state.connection.query.mockImplementation(async (sql: string, values: unknown[]) => {
    state.queries.push({ sql, values });
    if (sql.includes('SELECT a.id FROM')) return [state.appointment ? [{ id: 'appt' }] : [], []];
    if (sql.includes('fatura_convenio_ref')) return [state.coverage, []];
    if (sql.includes('SELECT c.id, c.ref_core') || sql.includes('SELECT c.ref_core')) return [state.charges, []];
    return [[], []];
  });
  state.connection.execute.mockImplementation(async (sql: string, values: unknown[]) => {
    if (sql.includes('INSERT INTO financeiro_ajustes')) state.inserted.push(values);
    return [{ affectedRows: 1 }, []];
  });
});

it('recusa vencimento passado sem abrir transação', async () => {
  await expect(atualizarVencimentoPorCobranca({ ...input, dueAt: '2000-01-01T12:00:00Z' })).resolves.toBe('invalid');
  expect(state.connection.beginTransaction).not.toHaveBeenCalled();
});

it('delimita agenda e cobrança pela organização autenticada', async () => {
  await atualizarVencimentoPorCobranca(input);
  const scoped = state.queries.filter(({ sql }) => sql.includes('SELECT a.id FROM') || sql.includes('SELECT c.id, c.ref_core') || sql.includes('fatura_convenio_ref'));
  expect(scoped).toHaveLength(3);
  for (const query of scoped) expect(query.values).toEqual(['inst', 'org', 'charge']);
});

it('enfileira pelo agendamento e processa após o commit', async () => {
  await expect(atualizarVencimentoPorCobranca(input)).resolves.toBe('updated');
  expect(state.inserted[0].slice(1, 4)).toEqual(['inst', 'appt', input.dueAt]);
  expect(state.connection.commit.mock.invocationCallOrder[0])
    .toBeLessThan(vi.mocked(processAppointmentChargeDue).mock.invocationCallOrder[0]);
  expect(processAppointmentChargeDue).toHaveBeenCalledWith('appt');
});

it('altera cobrança legada sem agenda usando a chave física da cobrança', async () => {
  state.appointment = false;
  await expect(atualizarVencimentoPorCobranca(input)).resolves.toBe('updated');
  expect(state.inserted[0].slice(1, 4)).toEqual(['inst', 'charge-row', input.dueAt]);
  expect(processAppointmentChargeDue).toHaveBeenCalledWith('charge-row');
});

it.each([
  ['inexistente ou de outra organização', () => { state.charges = []; }, 'not_found'],
  ['já paga', () => { state.charges[0].possui_pagamento = 1; }, 'paid'],
  ['custeada pela empresa', () => { state.coverage = [{ custeado: 1, fatura_convenio_ref: null }]; }, 'covered'],
  ['faturada ao convênio', () => { state.coverage = [{ custeado: 0, fatura_convenio_ref: 'invoice' }]; }, 'covered'],
] as const)('não grava nada para cobrança %s', async (_, arrange, outcome) => {
  arrange();
  await expect(atualizarVencimentoPorCobranca(input)).resolves.toBe(outcome);
  expect(state.inserted).toHaveLength(0);
  expect(state.connection.commit).not.toHaveBeenCalled();
  expect(processAppointmentChargeDue).not.toHaveBeenCalled();
});
