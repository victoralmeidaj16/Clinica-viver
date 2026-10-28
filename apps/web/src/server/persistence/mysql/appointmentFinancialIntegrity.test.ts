import { beforeEach, expect, it, vi } from 'vitest';
import type { Pool } from 'mysql2/promise';
import { rescheduleAppointment, scheduleAppointment } from '@thats-life/core';
vi.mock('server-only', () => ({}));
const reset = vi.hoisted(() => vi.fn());
vi.mock('@/server/payments/sessionChargeDue', () => ({ resetAppointmentChargeDue: reset }));
import { MysqlAppointmentRepository } from './appointmentRepository';
const metadata = { actorUserId: 'user-test', occurredAt: '2026-10-27T12:00:00Z', correlationId: 'test' };
const original = scheduleAppointment({ id: 'appointment-test', organizationId: 'org-test', patientId: 'patient-test',
  professionalId: 'pro-test', startsAt: '2099-01-10T14:00:00Z', endsAt: '2099-01-10T14:50:00Z', timezone: 'America/Sao_Paulo',
  mode: 'video', reminders: [], createdAt: metadata.occurredAt }, metadata).appointment;
beforeEach(() => vi.resetAllMocks());
function database(version = 0, priced = true) {
  const connection = { beginTransaction: vi.fn(), commit: vi.fn(), rollback: vi.fn(), release: vi.fn(),
    execute: vi.fn(async () => [{ affectedRows: 1 }, []]),
    query: vi.fn(async (sql: string) => [sql.includes('SELECT versao') ? [{ versao: version }]
      : sql.includes('categoria_valor_sessao') ? [{ categoria_valor_sessao: priced ? 'personalizado' : null, valor_sessao_personalizado_centavos: priced ? 6800 : null,
        valor_social_centavos: priced ? 7500 : null, valor_sessao_centavos: priced ? 13000 : null, modalidade_triagem: 'PARTICULAR' }] : [], []]) };
  return { connection, repository: new MysqlAppointmentRepository({ getConnection: async () => connection } as unknown as Pool) };
}
it('congela o valor personalizado do paciente ao criar o agendamento manual', async () => {
  const { connection, repository } = database();
  await repository.commit({ appointment: original, expectedVersion: 0, commandId: 'create', events: [] });
  expect(connection.execute).toHaveBeenCalledWith(expect.stringContaining('SET valor_centavos = ?'),
    expect.arrayContaining([6800]));
});
it('preserva a reserva de agenda para perfis ainda sem preço configurado', async () => {
  const { connection, repository } = database(0, false);
  await repository.commit({ appointment: original, expectedVersion: 0, commandId: 'create', events: [] });
  expect(connection.commit).toHaveBeenCalledOnce();
  expect(connection.execute).not.toHaveBeenCalledWith(expect.stringContaining('SET valor_centavos = ?'), expect.anything());
});
it('salva a intenção financeira na mesma transação da remarcação', async () => {
  const { connection, repository } = database(1);
  const result = rescheduleAppointment(original, '2099-01-11T14:00:00Z', '2099-01-11T14:50:00Z', metadata);
  await repository.commit({ ...result, expectedVersion: 1, commandId: 'reschedule' });
  expect(reset).toHaveBeenCalledWith(connection, expect.any(String), '2099-01-11T14:00:00Z');
  expect(reset.mock.invocationCallOrder[0]).toBeLessThan(connection.commit.mock.invocationCallOrder[0]);
});
it('reverte agenda e comando quando a intenção financeira não pode ser salva', async () => {
  const { connection, repository } = database(1);
  reset.mockRejectedValue(new Error('Pagamento em emissão'));
  const result = rescheduleAppointment(original, '2099-01-11T14:00:00Z', '2099-01-11T14:50:00Z', metadata);
  await expect(repository.commit({ ...result, expectedVersion: 1, commandId: 'reschedule' })).rejects.toThrow('em emissão');
  expect(connection.rollback).toHaveBeenCalledOnce();
  expect(connection.commit).not.toHaveBeenCalled();
});
