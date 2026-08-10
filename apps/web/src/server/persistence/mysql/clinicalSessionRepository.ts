import 'server-only';

import type { ResultSetHeader, RowDataPacket } from 'mysql2';
import type { Pool, PoolConnection } from 'mysql2/promise';
import type {
  ClinicalSession,
  ClinicalSessionEvent,
  ClinicalSessionFilter,
  ClinicalSessionRepository,
  ClinicalSessionStatus,
  CommitClinicalSessionInput,
  SessionAutomationPlan,
  SessionAutomationState,
  SessionConsentRecord,
  SessionMode,
} from '@thats-life/core';
import { getMysqlPool } from '@/server/oci/runtime';
import { fromSqlTimestamp, instituicaoId, rowId, toSqlTimestamp } from './mappers';

/**
 * Sessão clínica no MySQL, no recorte da Viver Mais.
 *
 * Aqui a sessão é **registro do atendimento**: ela liga agendamento, prontuário
 * e cobrança. Não há gravação, transcrição, entrega ao paciente nem recibo —
 * a clínica não usa nada disso, e o schema não guarda coluna para fluxo que
 * não acontece.
 *
 * Consentimentos, plano e estado de automação viajam como JSON, sem
 * interpretação: nenhuma consulta filtra por eles, e guardá-los inteiros faz o
 * agregado voltar do banco idêntico ao que entrou.
 */

export class ClinicalSessionVersionConflictError extends Error {
  constructor(readonly expected: number, readonly current: number) {
    super(`Conflito de versão da sessão: esperado ${expected}, atual ${current}.`);
    this.name = 'ClinicalSessionVersionConflictError';
  }
}

export class SessionRecordingNotSupportedError extends Error {
  constructor(readonly sessionId: string) {
    super(
      `A sessão ${sessionId} traz gravação ou transcrição, e esta instalação não captura áudio de consulta.`
    );
    this.name = 'SessionRecordingNotSupportedError';
  }
}

interface SessaoRow extends RowDataPacket {
  ref_core: string;
  organizacao_ref: string;
  paciente_ref: string;
  profissional_principal_ref: string;
  profissionais_atribuidos: unknown;
  status: ClinicalSessionStatus;
  modalidade: SessionMode;
  inicio_previsto: string;
  fim_previsto: string;
  inicio_real: string | null;
  fim_real: string | null;
  cancelamento_codigo: string | null;
  consentimentos: unknown;
  automacao_plano: unknown;
  automacao_estado: unknown;
  prontuario_aprovado_ref: string | null;
  cobranca_ref: string | null;
  versao: number;
  criado_em: string;
  atualizado_em: string;
}

function parseJson<T>(value: unknown, fallback: T): T {
  if (value === null || value === undefined) return fallback;
  if (typeof value === 'string') {
    try {
      return JSON.parse(value) as T;
    } catch {
      return fallback;
    }
  }
  return value as T;
}

function asStringArray(value: unknown): string[] {
  const parsed = parseJson<unknown>(value, []);
  return Array.isArray(parsed) ? parsed.filter((item): item is string => typeof item === 'string') : [];
}

function toSession(row: SessaoRow): ClinicalSession {
  const artifacts = {
    ...(row.prontuario_aprovado_ref ? { approvedClinicalRecordId: row.prontuario_aprovado_ref } : {}),
    ...(row.cobranca_ref ? { chargeId: row.cobranca_ref } : {}),
  };

  return {
    schemaVersion: 1,
    id: row.ref_core,
    organizationId: row.organizacao_ref,
    patientId: row.paciente_ref,
    primaryProfessionalId: row.profissional_principal_ref,
    assignedProfessionalIds: asStringArray(row.profissionais_atribuidos),
    status: row.status,
    mode: row.modalidade,
    scheduledStart: fromSqlTimestamp(row.inicio_previsto) ?? new Date(0).toISOString(),
    scheduledEnd: fromSqlTimestamp(row.fim_previsto) ?? new Date(0).toISOString(),
    actualStart: fromSqlTimestamp(row.inicio_real),
    actualEnd: fromSqlTimestamp(row.fim_real),
    cancellationReasonCode: row.cancelamento_codigo ?? undefined,
    consentRecords: parseJson<SessionConsentRecord[]>(row.consentimentos, []),
    automationPlan: parseJson<SessionAutomationPlan>(row.automacao_plano, {
      transcription: false,
      patientHandoff: false,
      billing: false,
      receipt: false,
      notification: false,
    }),
    automation: parseJson<SessionAutomationState>(row.automacao_estado, {} as SessionAutomationState),
    artifacts,
    version: row.versao,
    createdAt: fromSqlTimestamp(row.criado_em) ?? new Date(0).toISOString(),
    updatedAt: fromSqlTimestamp(row.atualizado_em) ?? new Date(0).toISOString(),
  };
}

const SESSAO_SELECT = `
  SELECT ref_core, organizacao_ref, paciente_ref, profissional_principal_ref,
         profissionais_atribuidos, status, modalidade, inicio_previsto, fim_previsto,
         inicio_real, fim_real, cancelamento_codigo, consentimentos, automacao_plano,
         automacao_estado, prontuario_aprovado_ref, cobranca_ref, versao,
         criado_em, atualizado_em
    FROM clinica_sessoes
   WHERE instituicao_id = ? AND organizacao_ref = ?`;

export class MysqlClinicalSessionRepository implements ClinicalSessionRepository {
  constructor(private readonly pool: Pool = getMysqlPool()) {}

  async getById(organizationId: string, sessionId: string): Promise<ClinicalSession | null> {
    const [rows] = await this.pool.query<SessaoRow[]>(`${SESSAO_SELECT} AND ref_core = ?`, [
      instituicaoId(),
      organizationId,
      sessionId,
    ]);
    return rows[0] ? toSession(rows[0]) : null;
  }

  async findByCommandId(organizationId: string, commandId: string): Promise<ClinicalSession | null> {
    const [rows] = await this.pool.query<RowDataPacket[]>(
      `SELECT agregado_ref FROM clinica_comandos
        WHERE instituicao_id = ? AND comando_id = ? AND agregado_tipo = 'clinical_session'`,
      [instituicaoId(), commandId]
    );
    const ref = (rows as Array<{ agregado_ref: string }>)[0]?.agregado_ref;
    return ref ? this.getById(organizationId, ref) : null;
  }

  async list(filter: ClinicalSessionFilter): Promise<readonly ClinicalSession[]> {
    const clauses: string[] = [];
    const params: unknown[] = [instituicaoId(), filter.organizationId];

    if (filter.patientId) {
      clauses.push('paciente_ref = ?');
      params.push(filter.patientId);
    }
    if (filter.professionalId) {
      clauses.push(
        '(profissional_principal_ref = ? OR JSON_CONTAINS(profissionais_atribuidos, JSON_QUOTE(?)))'
      );
      params.push(filter.professionalId, filter.professionalId);
    }
    if (filter.statuses?.length) {
      clauses.push('status IN (?)');
      params.push([...filter.statuses]);
    }
    if (filter.scheduledFrom) {
      clauses.push('inicio_previsto >= ?');
      params.push(toSqlTimestamp(filter.scheduledFrom));
    }
    if (filter.scheduledUntil) {
      clauses.push('inicio_previsto <= ?');
      params.push(toSqlTimestamp(filter.scheduledUntil));
    }

    const sql = `${SESSAO_SELECT}${clauses.map((c) => ` AND ${c}`).join('')} ORDER BY inicio_previsto`;
    const [rows] = await this.pool.query<SessaoRow[]>(sql, params);
    return rows.map(toSession);
  }

  async commit(input: CommitClinicalSessionInput): Promise<void> {
    const { session } = input;

    // Recusa antes de abrir transação: gravar a sessão sem a gravação seria
    // apagar em silêncio a referência de um áudio que existe em algum lugar.
    if (session.artifacts.recording || session.artifacts.transcription) {
      throw new SessionRecordingNotSupportedError(session.id);
    }

    const id = rowId('sessao_clinica', session.id);
    const connection = await this.pool.getConnection();

    try {
      await connection.beginTransaction();

      const [claim] = await connection.execute<ResultSetHeader>(
        `INSERT IGNORE INTO clinica_comandos
           (id, instituicao_id, comando_id, agregado_tipo, agregado_id, agregado_ref, criado_em)
         VALUES (?, ?, ?, 'clinical_session', ?, ?, ?)`,
        [
          rowId('comando', input.commandId),
          instituicaoId(),
          input.commandId,
          id,
          session.id,
          toSqlTimestamp(session.updatedAt),
        ]
      );

      if (claim.affectedRows === 0) {
        await connection.rollback();
        return;
      }

      await this.assertVersion(connection, id, input.expectedVersion);
      await this.upsertSession(connection, id, session);
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
    const [rows] = await connection.query<RowDataPacket[]>(
      'SELECT versao FROM clinica_sessoes WHERE id = ? FOR UPDATE',
      [id]
    );
    const current = (rows as Array<{ versao: number }>)[0]?.versao ?? 0;
    if (current !== expected) throw new ClinicalSessionVersionConflictError(expected, current);
  }

  private async upsertSession(
    connection: PoolConnection,
    id: string,
    session: ClinicalSession
  ): Promise<void> {
    await connection.execute(
      `INSERT INTO clinica_sessoes
         (id, instituicao_id, organizacao_ref, ref_core, paciente_ref,
          profissional_principal_ref, profissionais_atribuidos, status, modalidade,
          inicio_previsto, fim_previsto, inicio_real, fim_real, cancelamento_codigo,
          consentimentos, automacao_plano, automacao_estado,
          prontuario_aprovado_ref, cobranca_ref, versao, criado_em, atualizado_em)
       VALUES (?, ?, ?, ?, ?, ?, CAST(? AS JSON), ?, ?, ?, ?, ?, ?, ?,
               CAST(? AS JSON), CAST(? AS JSON), CAST(? AS JSON), ?, ?, ?, ?, ?)
       ON DUPLICATE KEY UPDATE
         profissional_principal_ref = VALUES(profissional_principal_ref),
         profissionais_atribuidos = VALUES(profissionais_atribuidos),
         status = VALUES(status), modalidade = VALUES(modalidade),
         inicio_previsto = VALUES(inicio_previsto), fim_previsto = VALUES(fim_previsto),
         inicio_real = VALUES(inicio_real), fim_real = VALUES(fim_real),
         cancelamento_codigo = VALUES(cancelamento_codigo),
         consentimentos = VALUES(consentimentos),
         automacao_plano = VALUES(automacao_plano),
         automacao_estado = VALUES(automacao_estado),
         prontuario_aprovado_ref = VALUES(prontuario_aprovado_ref),
         cobranca_ref = VALUES(cobranca_ref),
         versao = VALUES(versao), atualizado_em = VALUES(atualizado_em)`,
      [
        id,
        instituicaoId(),
        session.organizationId,
        session.id,
        session.patientId,
        session.primaryProfessionalId,
        JSON.stringify(session.assignedProfessionalIds),
        session.status,
        session.mode,
        toSqlTimestamp(session.scheduledStart),
        toSqlTimestamp(session.scheduledEnd),
        session.actualStart ? toSqlTimestamp(session.actualStart) : null,
        session.actualEnd ? toSqlTimestamp(session.actualEnd) : null,
        session.cancellationReasonCode ?? null,
        JSON.stringify(session.consentRecords),
        JSON.stringify(session.automationPlan),
        JSON.stringify(session.automation),
        session.artifacts.approvedClinicalRecordId ?? null,
        session.artifacts.chargeId ?? null,
        session.version,
        toSqlTimestamp(session.createdAt),
        toSqlTimestamp(session.updatedAt),
      ]
    );
  }

  private async appendOutbox(
    connection: PoolConnection,
    id: string,
    events: readonly ClinicalSessionEvent[]
  ): Promise<void> {
    for (const event of events) {
      const payload = {
        sessionId: event.sessionId,
        patientId: event.patientId,
        actorUserId: event.actorUserId,
        metadata: event.metadata ?? {},
      };

      await connection.execute(
        `INSERT IGNORE INTO clinica_outbox
           (id, instituicao_id, agregado_tipo, agregado_id, tipo_evento, correlacao_id, payload, ocorrido_em)
         VALUES (?, ?, 'clinical_session', ?, ?, ?, CAST(? AS JSON), ?)`,
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
