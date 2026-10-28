import { expect, it, vi } from 'vitest';
import type { Pool } from 'mysql2/promise';
import { scheduleAppointment } from '@thats-life/core';
vi.mock('server-only', () => ({}));
import { MysqlAppointmentRepository } from './appointmentRepository';
it('salva o vencimento na transação do agendamento e o relê pelo repositório', async () => {
  let storedDueAt: unknown;
  let committed = false;
  const connection = {
    beginTransaction: vi.fn(), rollback: vi.fn(), release: vi.fn(),
    commit: async () => { committed = true; },
    query: async () => [[], []],
    execute: async (sql: string, values: unknown[]) => {
      if (sql.includes('INSERT INTO clinica_agendamentos\n')) storedDueAt = values.at(-1);
      return [{ affectedRows: 1 }, []];
    },
  };
  const pool = { getConnection: async () => connection,
    query: async (sql: string) => [committed && sql.includes('FROM clinica_agendamentos a\n') ? [{
      ref_core: 'appointment-test', organizacao_ref: 'org-test', paciente_ref: 'patient-test', profissional_ref: 'pro-test',
      inicio: '2099-01-10 14:00:00.000', fim: '2099-01-10 14:50:00.000', timezone: 'America/Sao_Paulo',
      modalidade: 'online', status: 'agendado', criado_em: '2026-10-27 12:00:00.000', atualizado_em: '2026-10-27 12:00:00.000',
      cobranca_vence_em: sql.includes('a.cobranca_vence_em') ? storedDueAt : null,
    }] : [], []],
  };
  const repository = new MysqlAppointmentRepository(pool as unknown as Pool);
  const appointment = scheduleAppointment({ id: 'appointment-test', organizationId: 'org-test', patientId: 'patient-test',
    professionalId: 'pro-test', startsAt: '2099-01-10T14:00:00Z', endsAt: '2099-01-10T14:50:00Z', chargeDueAt: '2099-01-09T15:00:00Z',
    timezone: 'America/Sao_Paulo', mode: 'video', reminders: [], createdAt: '2026-10-27T12:00:00Z' },
    { actorUserId: 'user-test', occurredAt: '2026-10-27T12:00:00Z', correlationId: 'test' }).appointment;
  await repository.commit({ appointment, expectedVersion: 0, commandId: 'command-test', events: [] });
  expect((await repository.getById('org-test', 'appointment-test'))?.chargeDueAt).toBe('2099-01-09T15:00:00.000Z');
});
