import 'server-only';

import type { RowDataPacket } from 'mysql2';
import type { Pool } from 'mysql2/promise';
import type {
  ClinicalTimelineCategory,
  ClinicalTimelineEntry,
  ClinicalTimelineFilter,
  ClinicalTimelineImportance,
  ClinicalTimelineRepository,
  ClinicalTimelineSourceType,
} from '@thats-life/core';
import { getMysqlPool } from '@/server/oci/runtime';
import { fromSqlTimestamp, instituicaoId, rowId, toSqlTimestamp } from './mappers';

/**
 * Linha do tempo clínica no MySQL.
 *
 * É projeção, não fonte: cada entrada aponta para o registro que a originou
 * (`evidencia_*`). Ela migra junto com o prontuário porque prontuário durável
 * com projeção volátil não é prontuário durável — a visão longitudinal do
 * paciente sumiria no primeiro restart, e é ela que a busca de memória clínica
 * percorre.
 *
 * Sem `commit` versionado: entrada de linha do tempo não é agregado com
 * transição de estado, é fato registrado. A idempotência vem da unicidade de
 * `ref_core`.
 */

interface LinhaRow extends RowDataPacket {
  ref_core: string;
  organizacao_ref: string;
  paciente_ref: string;
  profissionais_autorizados: unknown;
  categoria: ClinicalTimelineCategory;
  importancia: ClinicalTimelineImportance;
  ocorrido_em: string;
  registrado_em: string;
  titulo: string;
  resumo: string;
  trecho_evidencia: string | null;
  etiquetas: unknown;
  evidencia_tipo: ClinicalTimelineSourceType;
  evidencia_ref: string;
  evidencia_versao: number | null;
  evidencia_revisao_ref: string | null;
  evidencia_campo: string | null;
  evidencia_hash: string | null;
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

function toEntry(row: LinhaRow): ClinicalTimelineEntry {
  return {
    schemaVersion: 1,
    id: row.ref_core,
    organizationId: row.organizacao_ref,
    patientId: row.paciente_ref,
    authorizedProfessionalIds: asStringArray(row.profissionais_autorizados),
    category: row.categoria,
    importance: row.importancia,
    occurredAt: fromSqlTimestamp(row.ocorrido_em) ?? new Date(0).toISOString(),
    recordedAt: fromSqlTimestamp(row.registrado_em) ?? new Date(0).toISOString(),
    title: row.titulo,
    summary: row.resumo,
    evidenceExcerpt: row.trecho_evidencia ?? undefined,
    tags: asStringArray(row.etiquetas),
    evidence: {
      sourceType: row.evidencia_tipo,
      sourceId: row.evidencia_ref,
      sourceVersion: row.evidencia_versao ?? undefined,
      sourceRevisionId: row.evidencia_revisao_ref ?? undefined,
      sourceField: row.evidencia_campo ?? undefined,
      contentHashSha256: row.evidencia_hash ?? undefined,
    },
  };
}

const LINHA_SELECT = `
  SELECT ref_core, organizacao_ref, paciente_ref, profissionais_autorizados, categoria,
         importancia, ocorrido_em, registrado_em, titulo, resumo, trecho_evidencia,
         etiquetas, evidencia_tipo, evidencia_ref, evidencia_versao,
         evidencia_revisao_ref, evidencia_campo, evidencia_hash
    FROM clinica_linha_do_tempo
   WHERE instituicao_id = ? AND organizacao_ref = ?`;

export class MysqlClinicalTimelineRepository implements ClinicalTimelineRepository {
  constructor(private readonly pool: Pool = getMysqlPool()) {}

  async list(filter: ClinicalTimelineFilter): Promise<readonly ClinicalTimelineEntry[]> {
    const clauses: string[] = ['paciente_ref = ?'];
    const params: unknown[] = [instituicaoId(), filter.organizationId, filter.patientId];

    if (filter.categories?.length) {
      clauses.push('categoria IN (?)');
      params.push([...filter.categories]);
    }
    if (filter.occurredFrom) {
      clauses.push('ocorrido_em >= ?');
      params.push(toSqlTimestamp(filter.occurredFrom));
    }
    if (filter.occurredUntil) {
      clauses.push('ocorrido_em <= ?');
      params.push(toSqlTimestamp(filter.occurredUntil));
    }

    const sql = `${LINHA_SELECT}${clauses.map((c) => ` AND ${c}`).join('')} ORDER BY ocorrido_em DESC`;
    const [rows] = await this.pool.query<LinhaRow[]>(sql, params);
    return rows.map(toEntry);
  }

  /**
   * Grava a entrada. `INSERT ... ON DUPLICATE KEY UPDATE` porque a projeção
   * pode ser recalculada a partir da fonte — reprojetar corrige a entrada em
   * vez de duplicá-la.
   */
  private async gravar(entry: ClinicalTimelineEntry): Promise<void> {
    await this.pool.execute(
      `INSERT INTO clinica_linha_do_tempo
         (id, instituicao_id, organizacao_ref, ref_core, paciente_ref,
          profissionais_autorizados, categoria, importancia, ocorrido_em, registrado_em,
          titulo, resumo, trecho_evidencia, etiquetas, evidencia_tipo, evidencia_ref,
          evidencia_versao, evidencia_revisao_ref, evidencia_campo, evidencia_hash)
       VALUES (?, ?, ?, ?, ?, CAST(? AS JSON), ?, ?, ?, ?, ?, ?, ?, CAST(? AS JSON), ?, ?, ?, ?, ?, ?)
       ON DUPLICATE KEY UPDATE
         profissionais_autorizados = VALUES(profissionais_autorizados),
         categoria = VALUES(categoria), importancia = VALUES(importancia),
         ocorrido_em = VALUES(ocorrido_em), registrado_em = VALUES(registrado_em),
         titulo = VALUES(titulo), resumo = VALUES(resumo),
         trecho_evidencia = VALUES(trecho_evidencia), etiquetas = VALUES(etiquetas),
         evidencia_tipo = VALUES(evidencia_tipo), evidencia_ref = VALUES(evidencia_ref),
         evidencia_versao = VALUES(evidencia_versao),
         evidencia_revisao_ref = VALUES(evidencia_revisao_ref),
         evidencia_campo = VALUES(evidencia_campo), evidencia_hash = VALUES(evidencia_hash)`,
      [
        rowId('linha_do_tempo', entry.id),
        instituicaoId(),
        entry.organizationId,
        entry.id,
        entry.patientId,
        JSON.stringify(entry.authorizedProfessionalIds),
        entry.category,
        entry.importance,
        toSqlTimestamp(entry.occurredAt),
        toSqlTimestamp(entry.recordedAt),
        entry.title,
        entry.summary,
        entry.evidenceExcerpt ?? null,
        JSON.stringify(entry.tags),
        entry.evidence.sourceType,
        entry.evidence.sourceId,
        entry.evidence.sourceVersion ?? null,
        entry.evidence.sourceRevisionId ?? null,
        entry.evidence.sourceField ?? null,
        entry.evidence.contentHashSha256 ?? null,
      ]
    );
  }

  async upsert(entries: readonly ClinicalTimelineEntry[]): Promise<void> {
    for (const entry of entries) {
      await this.gravar(entry);
    }
  }
}
