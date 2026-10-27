import { expect, it, vi } from 'vitest';
import type { Pool } from 'mysql2/promise';
import { scheduleAppointment } from '@thats-life/core';

vi.mock('server-only', () => ({}));
import { MysqlAppointmentRepository } from './appointmentRepository';

it('impede agendamento manual durante um bloqueio existente', async () => {
  const connection = {
    beginTransaction: vi.fn(), commit: vi.fn(), rollback: vi.fn(), release: vi.fn(),
    execute: vi.fn(async () => [{ affectedRows: 1 }, []]),
    query: vi.fn(async (sql: string) => [sql.includes('clinica_agenda_bloqueios') ? [{ id: 'block' }] : [], []]),
  };
  const repository = new MysqlAppointmentRepository({ getConnection: async () => connection } as unknown as Pool);
  const appointment = scheduleAppointment({ id: 'apt', organizationId: 'org', patientId: 'patient', professionalId: 'pro',
    startsAt: '2099-01-01T12:00:00Z', endsAt: '2099-01-01T12:50:00Z', timezone: 'America/Sao_Paulo',
    mode: 'video', reminders: [], createdAt: '2098-01-01T12:00:00Z' },
    { actorUserId: 'user', occurredAt: '2098-01-01T12:00:00Z', correlationId: 'correlation' }).appointment;
  await expect(repository.commit({ appointment, expectedVersion: 0, commandId: 'command', events: [] })).rejects.toThrow(/conflito/i);
  expect(connection.commit).not.toHaveBeenCalled();
});
