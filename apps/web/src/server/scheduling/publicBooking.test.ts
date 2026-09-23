import { beforeEach, describe, expect, it, vi } from 'vitest';
vi.mock('server-only', () => ({}));
vi.mock('./agendaReagendamentoEffects', () => ({ concluirReagendamento: vi.fn(async () => {}) }));
import { concluirReagendamento } from './agendaReagendamentoEffects';
const { connection, poolQuery } = vi.hoisted(() => ({
  poolQuery: vi.fn(),
  connection: { beginTransaction: vi.fn(), commit: vi.fn(), rollback: vi.fn(), release: vi.fn(), query: vi.fn(), execute: vi.fn() },
}));
vi.mock('@/server/oci/runtime', () => ({
  isMysqlConfigured: () => true,
  getMysqlPool: () => ({ query: poolQuery, getConnection: async () => connection }),
}));
vi.mock('@/server/persistence/mysql/mappers', () => ({
  instituicaoId: () => 'inst', rowId: (prefix: string, ref: string) => `${prefix}:${ref}`,
}));
import { bookAppointments, rescheduleAppointmentPublic } from './agendaRepository';
const patient = { patientRef: 'p', patientRowId: 'p', nome: 'Teste', organizationId: 'org',
  professionalId: 'pro', professionalRowId: 'pro', professionalName: 'Teste', sessionAmountCents: 10000 };
const now = new Date('2026-09-14T10:00:00Z');
const start = '2026-09-15T12:00:00.000Z';
const appointment = { id: 'a', ref_core: 'ref-a', inicio: '2026-09-16T12:00:00Z',
  duracao_min: 50, modalidade: 'online', token_pagamento_sessao: null, versao: 2 };
const window = { dia_semana: 2, hora_inicio: '09:00:00', hora_fim: '12:00:00', duracao_min: 60, modalidade: 'presencial' };
beforeEach(() => {
  vi.clearAllMocks();
  poolQuery.mockImplementation(async (sql: string) => [sql.includes('FROM clinica_disponibilidades') ? [window] : [], []]);
  connection.query.mockImplementation(async (sql: string) => {
    if (sql.includes('SELECT a.id, a.ref_core, a.inicio')) return [[appointment], []];
    if (sql.includes('FROM clinica_organizacoes')) return [[{ id: 'org' }], []];
    return [[], []];
  });
  connection.execute.mockResolvedValue([{ affectedRows: 1 }, []]);
});
describe('reagendamento público', () => {
  it.each(['2026-09-15T03:00:00Z', '2026-09-08T12:00:00Z', 'invalid', '2027-09-15T12:00:00Z'])('recusa horário inválido: %s', async value => {
    expect(await rescheduleAppointmentPublic(patient, 'a', value, now)).toEqual({ ok: false, motivo: 'INDISPONIVEL' });
    expect(connection.execute).not.toHaveBeenCalled();
  });
  it('salva token devolvido, duração e modalidade do horário escolhido', async () => {
    const result = await rescheduleAppointmentPublic(patient, 'a', start, now);
    expect(result).toMatchObject({ ok: true, inicio: start, fim: '2026-09-15T13:00:00.000Z', modalidade: 'presencial' });
    if (!result.ok) throw new Error('Reagendamento falhou');
    const update = connection.execute.mock.calls.find(([sql]) => sql.includes('UPDATE clinica_agendamentos'))!;
    expect(update[0]).toContain('token_pagamento_sessao = ?');
    expect(update[1]).toEqual([new Date(start), new Date('2026-09-15T13:00:00Z'), 60, 'presencial', result.linkPagamento.split('/').at(-1), 'inst', 'a']);
    expect(connection.query.mock.calls[0][0]).toContain('FROM clinica_profissionais');
    expect(connection.commit).toHaveBeenCalledOnce();
    expect(concluirReagendamento).toHaveBeenCalledWith(expect.objectContaining({
      id: 'a', inicioAnterior: '2026-09-16T12:00:00.000Z', inicio: start, versao: 3,
    }));
    expect(connection.commit.mock.invocationCallOrder[0]).toBeLessThan(vi.mocked(concluirReagendamento).mock.invocationCallOrder[0]);
  });
  it('preserva token existente', async () => {
    connection.query.mockImplementation(async (sql: string) => [sql.includes('SELECT a.id, a.ref_core, a.inicio') ? [{ ...appointment, token_pagamento_sessao: 'existing' }] : [], []]);
    expect(await rescheduleAppointmentPublic(patient, 'a', start, now)).toMatchObject({ ok: true, linkPagamento: '/pagar/sessao/existing' });
  });
  it('mantém antecedência mínima de duas horas', async () => {
    connection.query.mockImplementation(async (sql: string) => [sql.includes('SELECT a.id, a.ref_core, a.inicio') ? [{ ...appointment, inicio: '2026-09-14T11:00:00Z' }] : [], []]);
    expect(await rescheduleAppointmentPublic(patient, 'a', start, now)).toEqual({ ok: false, motivo: 'PRAZO_EXPIRADO' });
    expect(connection.execute).not.toHaveBeenCalled();
  });
  it('recusa bloqueio criado após a escolha do horário', async () => {
    connection.query.mockImplementation(async (sql: string) => [sql.includes('SELECT a.id, a.ref_core, a.inicio') ? [appointment] : sql.includes('FROM clinica_agenda_bloqueios') ? [{ id: 'b' }] : [], []]);
    expect(await rescheduleAppointmentPublic(patient, 'a', start, now)).toEqual({ ok: false, motivo: 'INDISPONIVEL' });
    expect(connection.execute).not.toHaveBeenCalled();
    expect(concluirReagendamento).not.toHaveBeenCalled();
  });
});
describe('reserva múltipla', () => {
  it('normaliza datas equivalentes sem duplicar a reserva', async () => {
    const result = await bookAppointments(patient, [start, '2026-09-15T09:00:00-03:00'], now);
    expect(result.ok && result.agendamentos).toHaveLength(1);
    expect(connection.execute).toHaveBeenCalledOnce();
  });
  it('recusa sobreposição entre horários da própria seleção', async () => {
    poolQuery.mockImplementation(async (sql: string) => [sql.includes('FROM clinica_disponibilidades') ? [window, { ...window, hora_inicio: '09:30:00' }] : [], []]);
    expect(await bookAppointments(patient, [start, '2026-09-15T12:30:00Z'], now)).toEqual({ ok: false, motivo: 'INDISPONIVEL' });
    expect(connection.execute).not.toHaveBeenCalled();
  });
  it('aceita horários consecutivos', async () => {
    const result = await bookAppointments(patient, [start, '2026-09-15T13:00:00Z'], now);
    expect(result.ok && result.agendamentos).toHaveLength(2);
    expect(connection.commit).toHaveBeenCalledOnce();
  });
  it('respeita horizonte de 60 dias', async () => {
    expect(await bookAppointments(patient, [start, '2099-01-01T12:00:00Z'], now)).toEqual({ ok: false, motivo: 'INDISPONIVEL' });
    expect(poolQuery).not.toHaveBeenCalled();
  });
});
