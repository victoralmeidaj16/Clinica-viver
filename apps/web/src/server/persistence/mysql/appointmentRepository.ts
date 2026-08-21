import 'server-only';

import type { ResultSetHeader, RowDataPacket } from 'mysql2';
import type { Pool, PoolConnection } from 'mysql2/promise';
import type {
  Appointment,
  AppointmentEvent,
  AppointmentFilter,
  AppointmentRepository,
  CommitAppointmentInput,
} from '@thats-life/core';
import { getMysqlPool } from '@/server/oci/runtime';
import {
  instituicaoId,
  rowId,
  toAgendamentoStatus,
  toAppointment,
  toModalidade,
  toSqlTimestamp,
  type AgendamentoRow,
  type LembreteRow,
} from './mappers';

const AGENDAMENTO_SELECT = `
  SELECT a.ref_core, o.ref_core AS organizacao_ref, pa.ref_core AS paciente_ref,
         pr.ref_core AS profissional_ref, a.inicio, a.fim, a.duracao_min, a.timezone, a.modalidade,
         a.status, a.recorrencia, a.cancelado_codigo, a.sessao_clinica_ref, a.versao,
         a.criado_em, a.atualizado_em
    FROM clinica_agendamentos a
    JOIN clinica_organizacoes o ON o.id = a.organizacao_id
    JOIN clinica_pacientes pa ON pa.id = a.paciente_id
    JOIN clinica_profissionais pr ON pr.id = a.profissional_id
   WHERE a.instituicao_id = ? AND o.ref_core = ?`;

/**
 * Erro de concorrência otimista. A camada de aplicação o traduz em 409 — sem
 * isso, uma remarcação simultânea sobrescreveria a outra em silêncio.
 */
export class AppointmentVersionConflictError extends Error {
  constructor(readonly expected: number, readonly current: number) {
    super(`Conflito de versão: esperado ${expected}, atual ${current}.`);
    this.name = 'AppointmentVersionConflictError';
  }
}

export class MysqlAppointmentRepository implements AppointmentRepository {
  constructor(private readonly pool: Pool = getMysqlPool()) {}

  private async hydrate(rows: AgendamentoRow[]): Promise<readonly Appointment[]> {
    if (rows.length === 0) return [];
    const ids = rows.map((row) => rowId('agendamento', row.ref_core));
    const [lembretes] = await this.pool.query<RowDataPacket[]>(
      `SELECT a.ref_core AS agendamento_ref, l.ref_core, l.canal, l.minutos_antes
         FROM clinica_agendamentos_lembretes l
         JOIN clinica_agendamentos a ON a.id = l.agendamento_id
        WHERE l.agendamento_id IN (?)`,
      [ids]
    );
    return rows.map((row) => toAppointment(row, lembretes as LembreteRow[]));
  }

  async getById(organizationId: string, appointmentId: string): Promise<Appointment | null> {
    const [rows] = await this.pool.query<RowDataPacket[]>(`${AGENDAMENTO_SELECT} AND a.ref_core = ?`, [
      instituicaoId(),
      organizationId,
      appointmentId,
    ]);
    const hydrated = await this.hydrate(rows as AgendamentoRow[]);
    return hydrated[0] ?? null;
  }

  async list(filter: AppointmentFilter): Promise<readonly Appointment[]> {
    const clauses: string[] = [];
    const params: unknown[] = [instituicaoId(), filter.organizationId];

    if (filter.patientId) {
      clauses.push('pa.ref_core = ?');
      params.push(filter.patientId);
    }
    if (filter.professionalId) {
      clauses.push('pr.ref_core = ?');
      params.push(filter.professionalId);
    }
    if (filter.statuses?.length) {
      clauses.push('a.status IN (?)');
      params.push(filter.statuses.map(toAgendamentoStatus));
    }
    if (filter.startsFrom) {
      clauses.push('a.inicio >= ?');
      params.push(toSqlTimestamp(filter.startsFrom));
    }
    if (filter.startsUntil) {
      clauses.push('a.inicio <= ?');
      params.push(toSqlTimestamp(filter.startsUntil));
    }

    const sql = `${AGENDAMENTO_SELECT}${clauses.map((clause) => ` AND ${clause}`).join('')} ORDER BY a.inicio`;
    const [rows] = await this.pool.query<RowDataPacket[]>(sql, params);
    return this.hydrate(rows as AgendamentoRow[]);
  }

  async findByCommandId(organizationId: string, commandId: string): Promise<Appointment | null> {
    const [rows] = await this.pool.query<RowDataPacket[]>(
      `SELECT agregado_ref FROM clinica_comandos
        WHERE instituicao_id = ? AND comando_id = ? AND agregado_tipo = 'appointment'`,
      [instituicaoId(), commandId]
    );
    const ref = (rows as Array<{ agregado_ref: string }>)[0]?.agregado_ref;
    return ref ? this.getById(organizationId, ref) : null;
  }

  /**
   * Agregado, chave de idempotência e eventos numa transação só.
   *
   * A ordem importa. O `INSERT` em `clinica_comandos` vem primeiro porque a
   * unicidade `(instituicao_id, comando_id)` é o que transforma repetição em
   * replay: se a chave já existe, a transação é abortada e nada é reescrito —
   * mesma semântica do repositório em memória, agora garantida pelo banco em
   * vez de por um `Map` de um processo só.
   */
  async commit(input: CommitAppointmentInput): Promise<void> {
    const { appointment } = input;
    const id = rowId('agendamento', appointment.id);
    const connection = await this.pool.getConnection();

    try {
      await connection.beginTransaction();

      const [claim] = await connection.execute<ResultSetHeader>(
        `INSERT IGNORE INTO clinica_comandos
           (id, instituicao_id, comando_id, agregado_tipo, agregado_id, agregado_ref, criado_em)
         VALUES (?, ?, ?, 'appointment', ?, ?, ?)`,
        [
          rowId('comando', input.commandId),
          instituicaoId(),
          input.commandId,
          id,
          appointment.id,
          toSqlTimestamp(appointment.updatedAt),
        ]
      );

      // Comando já processado: replay não reescreve o agregado nem reemite
      // eventos. Duas requisições com a mesma Idempotency-Key produzem uma
      // cobrança e um lembrete, não dois.
      if (claim.affectedRows === 0) {
        await connection.rollback();
        return;
      }

      await this.assertVersion(connection, id, input.expectedVersion);
      await this.assertNoConflict(connection, id, appointment);
      await this.upsertAppointment(connection, id, appointment);
      await this.replaceReminders(connection, id, appointment);
      await this.appendOutbox(connection, id, input.events);

      await connection.commit();
    } catch (error) {
      await connection.rollback();
      throw error;
    } finally {
      connection.release();
    }
  }

  private async assertVersion(connection: PoolConnection, id: string, expected: number): Promise<void> {
    // `FOR UPDATE` segura a linha até o fim da transação. Sem isso, duas
    // remarcações concorrentes leriam a mesma versão e as duas passariam.
    const [rows] = await connection.query<RowDataPacket[]>(
      'SELECT versao FROM clinica_agendamentos WHERE id = ? FOR UPDATE',
      [id]
    );
    const current = (rows as Array<{ versao: number }>)[0]?.versao ?? 0;
    if (current !== expected) throw new AppointmentVersionConflictError(expected, current);
  }

  private async assertNoConflict(
    connection: PoolConnection,
    id: string,
    appointment: Appointment
  ): Promise<void> {
    // A checagem no core dá feedback rápido, mas não é suficiente para duas
    // requisições concorrentes. Esta consulta ocorre depois do BEGIN e antes
    // do INSERT/UPDATE, mantendo a decisão de agenda na mesma transação.
    if (appointment.status === 'cancelled') return;

    // A linha do profissional funciona como mutex de agenda. Sem um registro
    // estável para travar, duas agendas vazias poderiam passar na mesma
    // consulta de intervalo e só seriam detectadas depois do INSERT.
    await connection.query<RowDataPacket[]>(
      'SELECT id FROM clinica_profissionais WHERE instituicao_id = ? AND id = ? FOR UPDATE',
      [instituicaoId(), rowId('profissional', appointment.professionalId)]
    );

    const [rows] = await connection.query<RowDataPacket[]>(
      `SELECT a.id
         FROM clinica_agendamentos a
        WHERE a.instituicao_id = ?
          AND a.profissional_id = ?
          AND a.status <> 'cancelado'
          AND a.id <> ?
          AND a.inicio < ?
          AND COALESCE(a.fim, DATE_ADD(a.inicio, INTERVAL a.duracao_min MINUTE)) > ?
        FOR UPDATE`,
      [instituicaoId(), rowId('profissional', appointment.professionalId), id, toSqlTimestamp(appointment.endsAt), toSqlTimestamp(appointment.startsAt)]
    );

    if (rows.length > 0) {
      throw new Error('Há conflito com outro agendamento do profissional.');
    }
  }

  private async upsertAppointment(
    connection: PoolConnection,
    id: string,
    appointment: Appointment
  ): Promise<void> {
    const duracaoMin = Math.max(
      1,
      Math.round((Date.parse(appointment.endsAt) - Date.parse(appointment.startsAt)) / 60_000)
    );

    await connection.execute(
      `INSERT INTO clinica_agendamentos
         (id, instituicao_id, ref_core, organizacao_id, paciente_id, profissional_id, inicio, fim,
          timezone, duracao_min, modalidade, recorrencia, status, cancelado_codigo, sessao_clinica_ref,
          token_pagamento_sessao, origem_criacao, versao, criado_em, atualizado_em)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?,
               LOWER(REPLACE(UUID(), '-', '')), 'profissional', ?, ?, ?)
       ON DUPLICATE KEY UPDATE
         inicio = VALUES(inicio), fim = VALUES(fim), timezone = VALUES(timezone),
         duracao_min = VALUES(duracao_min), modalidade = VALUES(modalidade),
         recorrencia = VALUES(recorrencia), status = VALUES(status),
         cancelado_codigo = VALUES(cancelado_codigo), sessao_clinica_ref = VALUES(sessao_clinica_ref),
         versao = VALUES(versao), atualizado_em = VALUES(atualizado_em)`,
      [
        id,
        instituicaoId(),
        appointment.id,
        rowId('organizacao', appointment.organizationId),
        rowId('paciente', appointment.patientId),
        rowId('profissional', appointment.professionalId),
        toSqlTimestamp(appointment.startsAt),
        toSqlTimestamp(appointment.endsAt),
        appointment.timezone,
        duracaoMin,
        toModalidade(appointment.mode),
        appointment.recurrence ? JSON.stringify(appointment.recurrence) : null,
        toAgendamentoStatus(appointment.status),
        appointment.cancellationReasonCode ?? null,
        appointment.clinicalSessionId ?? null,
        appointment.version,
        toSqlTimestamp(appointment.createdAt),
        toSqlTimestamp(appointment.updatedAt),
      ]
    );

    // O valor fica congelado no nascimento da sessão. Reajustar o perfil
    // depois não pode alterar uma cobrança já combinada com o paciente.
    await connection.execute(
      `UPDATE clinica_agendamentos a
       JOIN clinica_profissionais p ON p.id = a.profissional_id
          SET a.valor_centavos = CASE
            WHEN EXISTS (
              SELECT 1 FROM clinica_triagens_pacientes t
               WHERE t.instituicao_id = a.instituicao_id
                 AND t.paciente_ref = ? AND UPPER(COALESCE(t.modalidade, '')) LIKE '%SOCIAL%'
            ) THEN p.valor_social_centavos
            ELSE p.valor_sessao_centavos
          END
        WHERE a.instituicao_id = ? AND a.id = ? AND a.valor_centavos IS NULL`,
      [appointment.patientId, instituicaoId(), id]
    );
  }

  private async replaceReminders(
    connection: PoolConnection,
    id: string,
    appointment: Appointment
  ): Promise<void> {
    await connection.execute('DELETE FROM clinica_agendamentos_lembretes WHERE agendamento_id = ?', [id]);
    for (const reminder of appointment.reminders) {
      await connection.execute(
        `INSERT INTO clinica_agendamentos_lembretes
           (id, instituicao_id, ref_core, agendamento_id, canal, minutos_antes)
         VALUES (?, ?, ?, ?, ?, ?)`,
        [
          rowId('lembrete', reminder.id),
          instituicaoId(),
          reminder.id,
          id,
          reminder.channel,
          reminder.minutesBefore,
        ]
      );
    }
  }

  private async appendOutbox(
    connection: PoolConnection,
    id: string,
    events: readonly AppointmentEvent[]
  ): Promise<void> {
    for (const event of events) {
      // O payload carrega referências, não conteúdo: nome, telefone e qualquer
      // texto clínico ficam fora da outbox por definição.
      const payload = {
        appointmentId: event.appointmentId,
        patientId: event.patientId,
        professionalId: event.professionalId,
        actorUserId: event.actorUserId,
        metadata: event.metadata ?? {},
      };

      await connection.execute(
        `INSERT IGNORE INTO clinica_outbox
           (id, instituicao_id, agregado_tipo, agregado_id, tipo_evento, correlacao_id, payload, ocorrido_em)
         VALUES (?, ?, 'appointment', ?, ?, ?, CAST(? AS JSON), ?)`,
        [
          rowId('outbox', event.id),
          instituicaoId(),
          id,
          event.type,
          event.correlationId,
          JSON.stringify(payload),
          toSqlTimestamp(event.occurredAt),
        ]
      );
    }
  }
}
