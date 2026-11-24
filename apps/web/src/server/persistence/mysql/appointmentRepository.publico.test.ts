import { expect, it, vi } from 'vitest';
import type { Pool } from 'mysql2/promise';
import { scheduleAppointment } from '@thats-life/core';
import { MysqlAppointmentRepository } from './appointmentRepository';

vi.mock('server-only', () => ({}));

it('insere o público e preserva o retrato original nas próximas edições', async () => {
  const execute = vi.fn<(sql: string, params: unknown[]) => Promise<unknown>>().mockResolvedValue([{ affectedRows: 1 }, []]);
  const connection = { execute, beginTransaction: vi.fn(), query: async () => [[], []],
    commit: vi.fn(), rollback: vi.fn(), release: vi.fn() };
  const query = vi.fn();
  const repository = new MysqlAppointmentRepository({ getConnection: async () => connection, query } as unknown as Pool);
  const createdAt = '2026-10-01T12:00:00Z';
  const { appointment } = scheduleAppointment({
    id: 'sessao', organizationId: 'org', patientId: 'pac', professionalId: 'pro', audience: 'Grupo',
    startsAt: '2099-01-10T14:00:00Z', endsAt: '2099-01-10T15:30:00Z',
    timezone: 'America/Sao_Paulo', mode: 'video', reminders: [], createdAt,
  }, { actorUserId: 'usuario', occurredAt: createdAt, correlationId: 'teste' });
  await repository.commit({ appointment, expectedVersion: 0, commandId: 'comando', events: [] });
  const [sql, params] = execute.mock.calls.find(([sql]) => /INSERT INTO clinica_agendamentos\s/.test(sql))!;
  const [insert, update] = sql.split('ON DUPLICATE KEY UPDATE');
  const columns = insert.match(/clinica_agendamentos\s*\(([^)]+)/)![1].split(',').map((col) => col.trim());
  expect(columns).toContain('publico_atendimento');
  expect(params[columns.indexOf('publico_atendimento')]).toBe('Grupo');
  expect(update).not.toContain('publico_atendimento');

  query.mockResolvedValueOnce([[{
    ref_core: 'sessao', organizacao_ref: 'org', paciente_ref: 'pac', profissional_ref: 'pro',
    inicio: appointment.startsAt, fim: appointment.endsAt, timezone: appointment.timezone,
    criado_em: createdAt, atualizado_em: createdAt, status: 'agendado', modalidade: 'online',
    publico_atendimento: params[columns.indexOf('publico_atendimento')],
  }]]).mockResolvedValueOnce([[]]);
  await expect(repository.getById('org', 'sessao')).resolves.toMatchObject({ audience: 'Grupo' });
  expect(query.mock.calls[0][0]).toContain('a.publico_atendimento');
});
