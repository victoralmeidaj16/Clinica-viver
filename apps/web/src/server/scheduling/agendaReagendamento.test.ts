import { beforeEach, describe, expect, it, vi } from 'vitest';
vi.mock('server-only', () => ({}));
const { connection, getConnection, execute, query } = vi.hoisted(() => {
  const connection = {
    beginTransaction: vi.fn(), commit: vi.fn(), rollback: vi.fn(), release: vi.fn(),
    query: vi.fn(), execute: vi.fn(),
  };
  return { connection, getConnection: vi.fn(async () => connection), execute: vi.fn(), query: vi.fn() };
});
vi.mock('@/server/oci/runtime', () => ({ isMysqlConfigured: () => true, getMysqlPool: () => ({ getConnection, execute, query }) }));
vi.mock('./agendaReagendamentoEffects', () => ({ concluirReagendamento: vi.fn(async () => {}) }));
import { concluirReagendamento } from './agendaReagendamentoEffects';
import { cancelAppointment, rescheduleAppointmentProfessional } from './agendaRepository';

beforeEach(() => {
  vi.resetAllMocks();
  getConnection.mockResolvedValue(connection);
  connection.query.mockImplementation(async (sql: string) => [sql.includes('SELECT a.id, a.ref_core, a.profissional_id')
    ? [{ id: 'appt', ref_core: 'appt-ref', profissional_id: 'pro', inicio: '2098-12-01T12:00:00Z', fim: '2098-12-01T12:50:00Z', versao: 3 }] : [], []]);
});
describe('intervalo do reagendamento profissional', () => {
  it.each([
    ['2099-01-01T15:00:00Z', '2099-01-01T14:00:00Z'],
    ['2099-01-01T15:00:00Z', '2099-01-01T15:00:00Z'],
    ['inválido', '2099-01-01T15:00:00Z'],
    ['2099-01-01T15:00:00Z', 'inválido'],
    ['', ''],
  ])('recusa %s — %s sem acessar o banco', async (start, end) => {
    expect(await rescheduleAppointmentProfessional('org', 'pro', 'appt', start, end)).toBe('invalid');
    expect(getConnection).not.toHaveBeenCalled();
  });
  it('permite intervalo válido que atravessa a meia-noite', async () => {
    expect(await rescheduleAppointmentProfessional('org', 'pro', 'appt', '2099-01-01T23:30:00Z', '2099-01-02T00:20:00Z')).toBe('ok');
    expect(connection.commit).toHaveBeenCalled();
    expect(connection.execute).toHaveBeenCalledWith(expect.stringContaining('UPDATE clinica_agendamentos'),
      [new Date('2099-01-01T23:30:00Z'), new Date('2099-01-02T00:20:00Z'), expect.any(String), 'appt']);
  });
  it('não permite alterar a duração pelo reagendamento', async () => {
    expect(await rescheduleAppointmentProfessional('org', 'pro', 'appt', '2099-01-01T12:00:00Z', '2099-01-01T13:30:00Z')).toBe('duration_locked');
    expect(connection.execute).not.toHaveBeenCalled();
  });
});
describe('cancelamento preserva atendimento e escopo', () => {
  it.each([
    { status: 'realizado', sessao_clinica_ref: null },
    { status: 'agendado', sessao_clinica_ref: 'clinical-session' },
    { status: 'cancelado', sessao_clinica_ref: 'clinical-session' },
  ])('bloqueia atendimento realizado ou materializado: %j', async (appointment) => {
    execute.mockResolvedValue([{ affectedRows: 1 }]);
    connection.query.mockResolvedValue([[{ id: 'appt', ...appointment }]]);
    expect(await cancelAppointment('org', 'pro', 'appt', 'motivo')).toBe('completed_locked');
    expect(execute).not.toHaveBeenCalled();
    expect(connection.execute).not.toHaveBeenCalled();
    expect(connection.release).toHaveBeenCalled();
  });
  it('permite retomar uma sessão já cancelada do mesmo profissional', async () => {
    connection.query.mockResolvedValue([[{ id: 'appt', status: 'cancelado', sessao_clinica_ref: null }]]);
    expect(await cancelAppointment('org', 'pro', 'appt', 'motivo')).toBe(true);
    expect(connection.execute).not.toHaveBeenCalled();
    expect(connection.query).toHaveBeenCalledWith(expect.stringContaining('FOR UPDATE'), [expect.any(String), 'org', 'pro', 'appt']);
    const sql = connection.query.mock.calls[0][0];
    expect(sql).toContain('a.instituicao_id = ?');
    expect(sql).toContain('o.ref_core = ?');
    expect(sql).toContain('p.ref_core = ?');
  });
  it.each(['agendado', 'confirmado'])('cancela uma sessão %s sem registro clínico', async (status) => {
    connection.query.mockResolvedValue([[{ id: 'appt', status, sessao_clinica_ref: null }]]);
    expect(await cancelAppointment('org', 'pro', 'appt', 'motivo')).toBe(true);
    expect(connection.execute).toHaveBeenCalledOnce();
    expect(connection.commit).toHaveBeenCalledOnce();
  });
  it('continua recusando sessão inexistente ou de outro profissional', async () => {
    connection.query.mockResolvedValue([[]]);
    expect(await cancelAppointment('org', 'pro', 'missing', 'motivo')).toBe(false);
    expect(connection.execute).not.toHaveBeenCalled();
  });
});

describe('reabertura financeira ao reagendar', () => {
  it('persiste o ajuste financeiro na transação e dispara os efeitos somente após commit', async () => {
    connection.query.mockImplementation(async (sql: string) => {
      if (sql.includes('SELECT a.id, a.ref_core, a.profissional_id')) return [[{ id: 'appt', ref_core: 'appt-ref', profissional_id: 'pro', inicio: '2098-12-01T12:00:00Z', fim: '2098-12-01T12:50:00Z', versao: 3 }], []];
      if (sql.includes('SELECT c.ref_core')) return [[{ ref_core: 'charge', status: 'overdue', organizacao_ref: 'org', possui_pagamento: 0 }], []];
      if (sql.includes('SELECT x.id')) return [[{ id: 'checkout', referencia_externa: 'VM-old', status: 'expired' }], []];
      return [[], []];
    });
    expect(await rescheduleAppointmentProfessional('org', 'pro', 'appt', '2099-01-01T12:00:00Z', '2099-01-01T12:50:00Z')).toBe('ok');
    expect(connection.execute).toHaveBeenCalledWith(expect.stringContaining('INSERT INTO financeiro_ajustes_vencimento'),
      [expect.any(String), expect.any(String), 'appt', expect.any(String), expect.any(String)]);
    expect(concluirReagendamento).toHaveBeenCalledWith(expect.objectContaining({ id: 'appt', versao: 4 }));
    expect(connection.commit.mock.invocationCallOrder[0]).toBeLessThan(vi.mocked(concluirReagendamento).mock.invocationCallOrder[0]);
    expect(connection.commit).toHaveBeenCalledOnce();
  });
  it('desfaz o reagendamento quando o pagamento ainda está sendo emitido', async () => {
    connection.query.mockImplementation(async (sql: string) => {
      if (sql.includes('SELECT a.id, a.ref_core, a.profissional_id')) return [[{ id: 'appt', ref_core: 'appt-ref', profissional_id: 'pro', inicio: '2098-12-01T12:00:00Z', fim: '2098-12-01T12:50:00Z', versao: 3 }], []];
      if (sql.includes('SELECT c.ref_core')) return [[{ ref_core: 'charge', status: 'pending', organizacao_ref: 'org' }], []];
      if (sql.includes('SELECT x.id')) return [[{ id: 'checkout', provedor: 'inter', provedor_pagamento_ref: null }], []];
      return [[], []];
    });
    await expect(rescheduleAppointmentProfessional('org', 'pro', 'appt', '2099-01-01T12:00:00Z', '2099-01-01T12:50:00Z')).rejects.toThrow('em emissão');
    expect(connection.rollback).toHaveBeenCalledOnce();
    expect(connection.commit).not.toHaveBeenCalled();
  });
});
