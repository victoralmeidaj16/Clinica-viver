import { beforeEach, describe, expect, it, vi } from 'vitest';
vi.mock('server-only', () => ({}));
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
import { bookAppointments, listAvailability, listAvailableSlots } from './agendaRepository';
const patient = { patientRef: 'p', patientRowId: 'p', nome: 'Teste', organizationId: 'org',
  professionalId: 'pro', professionalRowId: 'pro', professionalName: 'Teste', sessionAmountCents: 10000 };
const now = new Date('2026-09-14T10:00:00Z');
const start = '2026-09-15T12:00:00.000Z';
const window = { dia_semana: 2, hora_inicio: '09:00:00', hora_fim: '12:00:00', duracao_min: 60, modalidade: 'presencial' };
beforeEach(() => {
  vi.clearAllMocks();
  poolQuery.mockImplementation(async (sql: string) => [sql.includes('FROM clinica_disponibilidades') ? [window] : [], []]);
  connection.query.mockImplementation(async (sql: string) => {
    if (sql.includes('FROM clinica_organizacoes')) return [[{ id: 'org' }], []];
    if (sql.includes('FROM clinica_disponibilidades')) return [[window], []];
    return [[], []];
  });
  connection.execute.mockResolvedValue([{ affectedRows: 1 }, []]);
});
describe('reserva múltipla', () => {
  it('mantém a disponibilidade vazia depois de configurada', async () => {
    poolQuery.mockImplementation(async (sql: string) => [sql.includes('disponibilidade_configurada')
      ? [{ disponibilidade_configurada: 1 }] : [], []]);
    expect(await listAvailability('org', 'pro')).toEqual([]);
    expect(await listAvailableSlots(patient, now, new Date('2026-09-20T00:00:00Z'), now)).toEqual([]);
  });
  it('recusa horário quando a grade mudou antes da reserva', async () => {
    connection.query.mockImplementation(async (sql: string) => [sql.includes('disponibilidade_configurada')
      ? [{ disponibilidade_configurada: 1 }] : [], []]);
    expect(await bookAppointments(patient, [start], now)).toEqual({ ok: false, motivo: 'INDISPONIVEL' });
    expect(connection.execute).not.toHaveBeenCalled();
  });
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
  it('grava o valor resolvido como snapshot do novo agendamento', async () => {
    await expect(bookAppointments({ ...patient, sessionAmountCents: 6800 }, [start], now)).resolves.toMatchObject({ ok: true });
    const insert = connection.execute.mock.calls.find((call) => String(call[0]).includes('INSERT INTO clinica_agendamentos'));
    expect(insert?.[1]).toContain(6800);
  });
  it('respeita horizonte de 60 dias', async () => {
    expect(await bookAppointments(patient, [start, '2099-01-01T12:00:00Z'], now)).toEqual({ ok: false, motivo: 'INDISPONIVEL' });
    expect(poolQuery).not.toHaveBeenCalled();
  });
});
