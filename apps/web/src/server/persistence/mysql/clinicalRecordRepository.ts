import 'server-only';

import type { ResultSetHeader, RowDataPacket } from 'mysql2';
import type { Pool, PoolConnection } from 'mysql2/promise';
import type {
  ClinicalRecord,
  ClinicalRecordApproval,
  ClinicalRecordEvent,
  ClinicalRecordFilter,
  ClinicalRecordRepository,
  ClinicalRecordRevision,
  ClinicalRecordStatus,
  CommitClinicalRecordInput,
} from '@thats-life/core';
import { getMysqlPool } from '@/server/oci/runtime';
import { fromSqlTimestamp, instituicaoId, rowId, toSqlTimestamp } from './mappers';

/**
 * Prontuário no MySQL.
 *
 * Segue a forma de `MysqlAppointmentRepository`: agregado, chave de
 * idempotência e eventos numa transação só, com versão conferida sob
 * `SELECT ... FOR UPDATE`. O que muda é a natureza do dado — aqui o registro
 * tem guarda legal de cinco anos e não se reconstrói de lugar nenhum, então as
 * duas regras abaixo não são otimização, são o motivo de a tabela existir:
 *
 *   1. **Revisão nunca recebe `UPDATE`.** Retificar insere a revisão seguinte;
 *      a anterior permanece legível. É o que sustenta "a interface mostra as
 *      duas".
 *   2. **Aprovação guarda o hash do conteúdo aprovado.** Sem ele não há como
 *      provar, depois, que o texto no banco é o mesmo que o profissional
 *      assinou.
 *
 * Na Viver Mais o prontuário é escrito inteiramente pelo profissional — não há
 * gravação, transcrição nem rascunho de IA —, então não existe coluna de
 * proveniência. Uma revisão que chegue com `aiProvenance` é **recusada**, e não
 * gravada sem ela: campo de IA descartado em silêncio produziria um registro
 * clínico que afirma ser manual sem que ninguém tenha decidido isso.
 */

export class ClinicalRecordVersionConflictError extends Error {
  constructor(readonly expected: number, readonly current: number) {
    super(`Conflito de versão do prontuário: esperado ${expected}, atual ${current}.`);
    this.name = 'ClinicalRecordVersionConflictError';
  }
}

export class ClinicalRecordAiNotSupportedError extends Error {
  constructor(readonly revisionId: string) {
    super(
      `A revisão ${revisionId} traz proveniência de IA, e esta instalação registra prontuário apenas manual.`
    );
    this.name = 'ClinicalRecordAiNotSupportedError';
  }
}

interface ProntuarioRow extends RowDataPacket {
  ref_core: string;
  organizacao_ref: string;
  paciente_ref: string;
  sessao_ref: string;
  profissional_responsavel_ref: string;
  profissionais_atribuidos: unknown;
  status: ClinicalRecordStatus;
  revisao_rascunho_ativa: number | null;
  revisao_aprovada_atual: number | null;
  retencao_ate: string;
  retencao_legal: number;
  versao: number;
  criado_em: string;
  atualizado_em: string;
}

interface RevisaoRow extends RowDataPacket {
  prontuario_ref: string;
  ref_core: string;
  numero_revisao: number;
  tipo: 'initial' | 'amendment';
  origem: 'manual' | 'ai_assisted';
  subjetivo: string;
  objetivo: string;
  avaliacao: string;
  plano: string;
  tarefas_extraidas: unknown;
  motivo_retificacao: string | null;
  criado_por_usuario_ref: string;
  criado_em: string;
}

interface AprovacaoRow extends RowDataPacket {
  prontuario_ref: string;
  ref_core: string;
  numero_revisao: number;
  profissional_ref: string;
  aprovado_por_usuario_ref: string;
  aprovado_em: string;
  hash_conteudo: string;
  atestado: string;
}

function asStringArray(value: unknown): string[] {
  let parsed = value;
  if (typeof value === 'string') {
    try {
      parsed = JSON.parse(value) as unknown;
    } catch {
      parsed = [];
    }
  }
  return Array.isArray(parsed) ? parsed.filter((item): item is string => typeof item === 'string') : [];
}

function toRevision(row: RevisaoRow): ClinicalRecordRevision {
  return {
    id: row.ref_core,
    revisionNumber: row.numero_revisao,
    kind: row.tipo,
    source: row.origem,
    content: {
      subjective: row.subjetivo,
      objective: row.objetivo,
      assessment: row.avaliacao,
      plan: row.plano,
      extractedTasks: asStringArray(row.tarefas_extraidas),
    },
    amendmentReason: row.motivo_retificacao ?? undefined,
    createdByUserId: row.criado_por_usuario_ref,
    createdAt: fromSqlTimestamp(row.criado_em) ?? new Date(0).toISOString(),
  };
}

function toApproval(row: AprovacaoRow): ClinicalRecordApproval {
  return {
    id: row.ref_core,
    revisionNumber: row.numero_revisao,
    professionalId: row.profissional_ref,
    approvedByUserId: row.aprovado_por_usuario_ref,
    approvedAt: fromSqlTimestamp(row.aprovado_em) ?? new Date(0).toISOString(),
    contentHashSha256: row.hash_conteudo,
    attestation: row.atestado as ClinicalRecordApproval['attestation'],
  };
}

function toRecord(
  row: ProntuarioRow,
  revisions: readonly ClinicalRecordRevision[],
  approvals: readonly ClinicalRecordApproval[]
): ClinicalRecord {
  return {
    schemaVersion: 1,
    id: row.ref_core,
    organizationId: row.organizacao_ref,
    patientId: row.paciente_ref,
    sessionId: row.sessao_ref,
    responsibleProfessionalId: row.profissional_responsavel_ref,
    assignedProfessionalIds: asStringArray(row.profissionais_atribuidos),
    status: row.status,
    revisions,
    approvals,
    activeDraftRevisionNumber: row.revisao_rascunho_ativa ?? undefined,
    currentApprovedRevisionNumber: row.revisao_aprovada_atual ?? undefined,
    retentionUntil: fromSqlTimestamp(row.retencao_ate) ?? new Date(0).toISOString(),
    legalHold: Boolean(row.retencao_legal),
    version: row.versao,
    createdAt: fromSqlTimestamp(row.criado_em) ?? new Date(0).toISOString(),
    updatedAt: fromSqlTimestamp(row.atualizado_em) ?? new Date(0).toISOString(),
  };
}

const PRONTUARIO_SELECT = `
  SELECT ref_core, organizacao_ref, paciente_ref, sessao_ref,
         profissional_responsavel_ref, profissionais_atribuidos, status,
         revisao_rascunho_ativa, revisao_aprovada_atual, retencao_ate,
         retencao_legal, versao, criado_em, atualizado_em
    FROM clinica_prontuarios
   WHERE instituicao_id = ? AND organizacao_ref = ?`;

export class MysqlClinicalRecordRepository implements ClinicalRecordRepository {
  constructor(private readonly pool: Pool = getMysqlPool()) {}

  /**
   * Carrega revisões e aprovações dos prontuários em duas consultas, não em uma
   * por registro: a listagem de um paciente com anos de histórico faria N+1
   * viagens ao banco, e é justamente a tela que mais se abre.
   */
  private async hydrate(rows: ProntuarioRow[]): Promise<readonly ClinicalRecord[]> {
    if (rows.length === 0) return [];
    const ids = rows.map((row) => rowId('prontuario', row.ref_core));

    const [revisoes] = await this.pool.query<RevisaoRow[]>(
      `SELECT p.ref_core AS prontuario_ref, r.ref_core, r.numero_revisao, r.tipo, r.origem,
              r.subjetivo, r.objetivo, r.avaliacao, r.plano, r.tarefas_extraidas,
              r.motivo_retificacao, r.ia_provedor, r.ia_modelo, r.ia_prompt_versao,
              r.ia_transcricao_ref, r.ia_gerado_em, r.criado_por_usuario_ref, r.criado_em
         FROM clinica_prontuarios_revisoes r
         JOIN clinica_prontuarios p ON p.id = r.prontuario_id
        WHERE r.prontuario_id IN (?)
        ORDER BY r.numero_revisao`,
      [ids]
    );

    const [aprovacoes] = await this.pool.query<AprovacaoRow[]>(
      `SELECT p.ref_core AS prontuario_ref, a.ref_core, a.numero_revisao, a.profissional_ref,
              a.aprovado_por_usuario_ref, a.aprovado_em, a.hash_conteudo, a.atestado
         FROM clinica_prontuarios_aprovacoes a
         JOIN clinica_prontuarios p ON p.id = a.prontuario_id
        WHERE a.prontuario_id IN (?)
        ORDER BY a.numero_revisao`,
      [ids]
    );

    const porProntuario = <T extends { prontuario_ref: string }>(linhas: T[]) => {
      const mapa = new Map<string, T[]>();
      for (const linha of linhas) {
        const lista = mapa.get(linha.prontuario_ref) ?? [];
        lista.push(linha);
        mapa.set(linha.prontuario_ref, lista);
      }
      return mapa;
    };

    const revisoesPor = porProntuario(revisoes);
    const aprovacoesPor = porProntuario(aprovacoes);

    return rows.map((row) =>
      toRecord(
        row,
        (revisoesPor.get(row.ref_core) ?? []).map(toRevision),
        (aprovacoesPor.get(row.ref_core) ?? []).map(toApproval)
      )
    );
  }

  async getById(organizationId: string, recordId: string): Promise<ClinicalRecord | null> {
    const [rows] = await this.pool.query<ProntuarioRow[]>(`${PRONTUARIO_SELECT} AND ref_core = ?`, [
      instituicaoId(),
      organizationId,
      recordId,
    ]);
    const hydrated = await this.hydrate(rows);
    return hydrated[0] ?? null;
  }

  async findBySessionId(organizationId: string, sessionId: string): Promise<ClinicalRecord | null> {
    const [rows] = await this.pool.query<ProntuarioRow[]>(`${PRONTUARIO_SELECT} AND sessao_ref = ?`, [
      instituicaoId(),
      organizationId,
      sessionId,
    ]);
    const hydrated = await this.hydrate(rows);
    return hydrated[0] ?? null;
  }

  async findByCommandId(organizationId: string, commandId: string): Promise<ClinicalRecord | null> {
    const [rows] = await this.pool.query<RowDataPacket[]>(
      `SELECT agregado_ref FROM clinica_comandos
        WHERE instituicao_id = ? AND comando_id = ? AND agregado_tipo = 'clinical_record'`,
      [instituicaoId(), commandId]
    );
    const ref = (rows as Array<{ agregado_ref: string }>)[0]?.agregado_ref;
    return ref ? this.getById(organizationId, ref) : null;
  }

  async list(filter: ClinicalRecordFilter): Promise<readonly ClinicalRecord[]> {
    const clauses: string[] = [];
    const params: unknown[] = [instituicaoId(), filter.organizationId];

    if (filter.patientId) {
      clauses.push('paciente_ref = ?');
      params.push(filter.patientId);
    }
    if (filter.professionalId) {
      // Responsável ou atribuído: o sigilo por profissional precisa enxergar
      // supervisor e coautor, não só quem assinou.
      clauses.push("(profissional_responsavel_ref = ? OR JSON_CONTAINS(profissionais_atribuidos, JSON_QUOTE(?)))");
      params.push(filter.professionalId, filter.professionalId);
    }
    if (filter.statuses?.length) {
      clauses.push('status IN (?)');
      params.push([...filter.statuses]);
    }
    if (filter.createdFrom) {
      clauses.push('criado_em >= ?');
      params.push(toSqlTimestamp(filter.createdFrom));
    }
    if (filter.createdUntil) {
      clauses.push('criado_em <= ?');
      params.push(toSqlTimestamp(filter.createdUntil));
    }

    const sql = `${PRONTUARIO_SELECT}${clauses.map((c) => ` AND ${c}`).join('')} ORDER BY criado_em`;
    const [rows] = await this.pool.query<ProntuarioRow[]>(sql, params);
    return this.hydrate(rows);
  }

  async commit(input: CommitClinicalRecordInput): Promise<void> {
    const { record } = input;
    const id = rowId('prontuario', record.id);
    const connection = await this.pool.getConnection();

    try {
      await connection.beginTransaction();

      const [claim] = await connection.execute<ResultSetHeader>(
        `INSERT IGNORE INTO clinica_comandos
           (id, instituicao_id, comando_id, agregado_tipo, agregado_id, agregado_ref, criado_em)
         VALUES (?, ?, ?, 'clinical_record', ?, ?, ?)`,
        [
          rowId('comando', input.commandId),
          instituicaoId(),
          input.commandId,
          id,
          record.id,
          toSqlTimestamp(record.updatedAt),
        ]
      );

      // Comando repetido é replay: nada é reescrito e nenhum evento é reemitido.
      if (claim.affectedRows === 0) {
        await connection.rollback();
        return;
      }

      await this.assertVersion(connection, id, input.expectedVersion);
      await this.upsertRecord(connection, id, record);
      await this.appendRevisions(connection, id, record.revisions);
      await this.appendApprovals(connection, id, record.approvals);
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
      'SELECT versao FROM clinica_prontuarios WHERE id = ? FOR UPDATE',
      [id]
    );
    const current = (rows as Array<{ versao: number }>)[0]?.versao ?? 0;
    if (current !== expected) throw new ClinicalRecordVersionConflictError(expected, current);
  }

  private async upsertRecord(
    connection: PoolConnection,
    id: string,
    record: ClinicalRecord
  ): Promise<void> {
    await connection.execute(
      `INSERT INTO clinica_prontuarios
         (id, instituicao_id, organizacao_ref, ref_core, paciente_ref, sessao_ref,
          profissional_responsavel_ref, profissionais_atribuidos, status,
          revisao_rascunho_ativa, revisao_aprovada_atual, retencao_ate,
          retencao_legal, versao, criado_em, atualizado_em)
       VALUES (?, ?, ?, ?, ?, ?, ?, CAST(? AS JSON), ?, ?, ?, ?, ?, ?, ?, ?)
       ON DUPLICATE KEY UPDATE
         profissional_responsavel_ref = VALUES(profissional_responsavel_ref),
         profissionais_atribuidos = VALUES(profissionais_atribuidos),
         status = VALUES(status),
         revisao_rascunho_ativa = VALUES(revisao_rascunho_ativa),
         revisao_aprovada_atual = VALUES(revisao_aprovada_atual),
         retencao_ate = VALUES(retencao_ate),
         retencao_legal = VALUES(retencao_legal),
         versao = VALUES(versao),
         atualizado_em = VALUES(atualizado_em)`,
      [
        id,
        instituicaoId(),
        record.organizationId,
        record.id,
        record.patientId,
        record.sessionId,
        record.responsibleProfessionalId,
        JSON.stringify(record.assignedProfessionalIds),
        record.status,
        record.activeDraftRevisionNumber ?? null,
        record.currentApprovedRevisionNumber ?? null,
        toSqlTimestamp(record.retentionUntil),
        record.legalHold ? 1 : 0,
        record.version,
        toSqlTimestamp(record.createdAt),
        toSqlTimestamp(record.updatedAt),
      ]
    );
  }

  /**
   * `INSERT IGNORE` e nunca `UPDATE`.
   *
   * O agregado chega inteiro a cada commit, com todas as revisões — inclusive
   * as que já estão gravadas. Ignorar a repetição mantém o histórico
   * imutável: mesmo que a aplicação enviasse um texto diferente para uma
   * revisão antiga, o banco recusaria a reescrita em silêncio em vez de
   * apagar o que já foi assinado.
   */
  private async appendRevisions(
    connection: PoolConnection,
    id: string,
    revisions: readonly ClinicalRecordRevision[]
  ): Promise<void> {
    for (const revision of revisions) {
      // Recusa explícita: esta instalação não guarda proveniência de IA, e
      // gravar a revisão sem ela a transformaria numa nota manual que não é.
      if (revision.aiProvenance) throw new ClinicalRecordAiNotSupportedError(revision.id);

      await connection.execute(
        `INSERT IGNORE INTO clinica_prontuarios_revisoes
           (id, instituicao_id, prontuario_id, ref_core, numero_revisao, tipo, origem,
            subjetivo, objetivo, avaliacao, plano, tarefas_extraidas, motivo_retificacao,
            criado_por_usuario_ref, criado_em)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, CAST(? AS JSON), ?, ?, ?)`,
        [
          rowId('prontuario_revisao', revision.id),
          instituicaoId(),
          id,
          revision.id,
          revision.revisionNumber,
          revision.kind,
          revision.source,
          revision.content.subjective,
          revision.content.objective,
          revision.content.assessment,
          revision.content.plan,
          JSON.stringify(revision.content.extractedTasks),
          revision.amendmentReason ?? null,
          revision.createdByUserId,
          toSqlTimestamp(revision.createdAt),
        ]
      );
    }
  }

  /** Mesma regra da revisão: aprovação registrada não se reescreve. */
  private async appendApprovals(
    connection: PoolConnection,
    id: string,
    approvals: readonly ClinicalRecordApproval[]
  ): Promise<void> {
    for (const approval of approvals) {
      await connection.execute(
        `INSERT IGNORE INTO clinica_prontuarios_aprovacoes
           (id, instituicao_id, prontuario_id, ref_core, numero_revisao, profissional_ref,
            aprovado_por_usuario_ref, aprovado_em, hash_conteudo, atestado)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          rowId('prontuario_aprovacao', approval.id),
          instituicaoId(),
          id,
          approval.id,
          approval.revisionNumber,
          approval.professionalId,
          approval.approvedByUserId,
          toSqlTimestamp(approval.approvedAt),
          approval.contentHashSha256,
          approval.attestation,
        ]
      );
    }
  }

  private async appendOutbox(
    connection: PoolConnection,
    id: string,
    events: readonly ClinicalRecordEvent[]
  ): Promise<void> {
    for (const event of events) {
      // Referências, nunca conteúdo: nada de SOAP, queixa ou nome na outbox.
      const payload = {
        recordId: event.recordId,
        patientId: event.patientId,
        sessionId: event.sessionId,
        actorUserId: event.actorUserId,
        metadata: event.metadata ?? {},
      };

      await connection.execute(
        `INSERT IGNORE INTO clinica_outbox
           (id, instituicao_id, agregado_tipo, agregado_id, tipo_evento, correlacao_id, payload, ocorrido_em)
         VALUES (?, ?, 'clinical_record', ?, ?, ?, CAST(? AS JSON), ?)`,
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
