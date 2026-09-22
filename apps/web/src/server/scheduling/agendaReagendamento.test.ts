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
import { cancelAppointment, rescheduleAppointmentProfessional } from './agendaRepository';

beforeEach(() => {
  vi.resetAllMocks();
  getConnection.mockResolvedValue(connection);
  connection.query.mockImplementation(async (sql: string) => [sql.includes('SELECT a.id, a.ref_core, a.profissional_id')
    ? [{ id: 'appt', ref_core: 'appt-ref', profissional_id: 'pro' }] : [], []]);
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
});
describe('retomada do cancelamento financeiro', () => {
  it('permite retomar uma sessão já cancelada do mesmo profissional', async () => {
    execute.mockResolvedValue([{ affectedRows: 0 }]);
    query.mockResolvedValue([[{ id: 'appt' }]]);
    expect(await cancelAppointment('org', 'pro', 'appt', 'motivo')).toBe(true);
    expect(query).toHaveBeenCalledWith(expect.stringContaining("a.status = 'cancelado'"), [expect.any(String), 'org', 'pro', 'appt']);
  });
  it('continua recusando sessão inexistente ou de outro profissional', async () => {
    execute.mockResolvedValue([{ affectedRows: 0 }]);
    query.mockResolvedValue([[]]);
    expect(await cancelAppointment('org', 'pro', 'missing', 'motivo')).toBe(false);
  });
});

describe('reabertura financeira ao reagendar', () => {
  it('reabre a cobrança vencida e invalida o checkout expirado na mesma transação', async () => {
    connection.query.mockImplementation(async (sql: string) => {
      if (sql.includes('SELECT a.id, a.ref_core, a.profissional_id')) return [[{ id: 'appt', ref_core: 'appt-ref', profissional_id: 'pro' }], []];
      if (sql.includes('SELECT c.ref_core')) return [[{ ref_core: 'charge', status: 'overdue', organizacao_ref: 'org', possui_pagamento: 0 }], []];
      if (sql.includes('SELECT x.id')) return [[{ id: 'checkout', referencia_externa: 'VM-old', status: 'expired' }], []];
      return [[], []];
    });
    expect(await rescheduleAppointmentProfessional('org', 'pro', 'appt', '2099-01-01T12:00:00Z', '2099-01-01T13:00:00Z')).toBe('ok');
    expect(connection.execute).toHaveBeenCalledWith(expect.stringContaining("status = 'pending'"),
      [expect.anything(), expect.any(String), 'org', 'charge']);
    expect(connection.execute).toHaveBeenCalledWith(expect.stringContaining("status = 'creating'"),
      [expect.stringMatching(/^VM-/), expect.any(String), 'checkout']);
    expect(connection.commit).toHaveBeenCalledOnce();
  });
  it('desfaz o reagendamento quando o pagamento ainda está sendo emitido', async () => {
    connection.query.mockImplementation(async (sql: string) => {
      if (sql.includes('SELECT a.id, a.ref_core, a.profissional_id')) return [[{ id: 'appt', ref_core: 'appt-ref', profissional_id: 'pro' }], []];
      if (sql.includes('SELECT c.ref_core')) return [[{ ref_core: 'charge', status: 'pending', organizacao_ref: 'org' }], []];
      if (sql.includes('SELECT x.id')) return [[{ id: 'checkout', provedor: 'inter', provedor_pagamento_ref: null }], []];
      return [[], []];
    });
    await expect(rescheduleAppointmentProfessional('org', 'pro', 'appt', '2099-01-01T12:00:00Z', '2099-01-01T13:00:00Z')).rejects.toThrow('em emissão');
    expect(connection.rollback).toHaveBeenCalledOnce();
    expect(connection.commit).not.toHaveBeenCalled();
  });
});
