import 'server-only';

import type { RowDataPacket } from 'mysql2';
import type { Pool, PoolConnection } from 'mysql2/promise';
import { motivoValido } from '@/lib/desistencias';
import {
  emptySnapshot,
  readSnapshot,
  writeSnapshot,
  type AuditoriaDesistenciaRecord,
} from '@/server/application/persistence';
import { getMysqlPool, isMysqlConfigured } from '@/server/oci/runtime';
import { fromSqlTimestamp, instituicaoId, rowId, toSqlTimestamp } from './mysql/mappers';

/**
 * Auditoria de desistências (especificação final, 6.06 e 6.09).
 *
 * Até a migration 089 ela morava só no snapshot em arquivo do servidor, fora
 * das transações e do backup do banco. Com a tabela presente, o MySQL passa a
 * ser a fonte; na primeira leitura de uma organização sem linhas, os registros
 * antigos do arquivo são importados uma vez (`INSERT IGNORE` pela chave única).
 * Sem a tabela, o comportamento anterior continua valendo.
 */

export interface DesistenciaRepository {
  list(organizationId: string): Promise<AuditoriaDesistenciaRecord[]>;
  save(record: AuditoriaDesistenciaRecord): Promise<void>;
}

function pertence(record: AuditoriaDesistenciaRecord, organizationId: string): boolean {
  return !record.organizationId || record.organizationId === organizationId;
}

export class FileDesistenciaRepository implements DesistenciaRepository {
  async list(organizationId: string): Promise<AuditoriaDesistenciaRecord[]> {
    return (readSnapshot()?.auditoriaDesistencias ?? []).filter((item) => pertence(item, organizationId));
  }

  async save(record: AuditoriaDesistenciaRecord): Promise<void> {
    const snapshot = readSnapshot() ?? emptySnapshot();
    const atuais = snapshot.auditoriaDesistencias ?? [];
    const existe = atuais.some((item) => item.id === record.id);
    await writeSnapshot({
      ...snapshot,
      savedAt: new Date().toISOString(),
      auditoriaDesistencias: existe
        ? atuais.map((item) => (item.id === record.id ? record : item))
        : [record, ...atuais],
    });
  }
}

interface DesistenciaRow extends RowDataPacket {
  ref_core: string;
  organizacao_ref: string;
  paciente_ref: string | null;
  lead_ref: string | null;
  paciente_nome: string;
  psicologo_ref: string | null;
  psicologo_nome: string;
  motivo: string;
  descricao_detalhada: string | null;
  acao_sugestao: string | null;
  data_desistencia: string | Date;
  reengajado: number;
  observacoes_reengajamento: string | null;
  permitir_troca_psicologo: number;
  registrado_por_usuario_ref: string | null;
  registrado_por_perfil: string | null;
}

function toRecord(row: DesistenciaRow): AuditoriaDesistenciaRecord {
  return {
    id: row.ref_core,
    organizationId: row.organizacao_ref,
    pacienteId: row.paciente_ref ?? undefined,
    leadId: row.lead_ref ?? undefined,
    pacienteNome: row.paciente_nome,
    psicologoId: row.psicologo_ref ?? undefined,
    psicologoNome: row.psicologo_nome,
    // Motivo fora do vocabulário não chega a ser gravado; o `OUTRO` só protege
    // a leitura de uma linha editada à mão.
    motivo: motivoValido(row.motivo) ? row.motivo : 'OUTRO',
    descricaoDetalhada: row.descricao_detalhada ?? undefined,
    acaoSugestao: row.acao_sugestao ?? undefined,
    dataDesistencia: fromSqlTimestamp(row.data_desistencia) ?? new Date(0).toISOString(),
    reengajado: Boolean(row.reengajado),
    observacoesReengajamento: row.observacoes_reengajamento ?? undefined,
    permitirTrocaPsicologo: Boolean(row.permitir_troca_psicologo),
    ...(row.registrado_por_usuario_ref ? { registradoPorUsuarioRef: row.registrado_por_usuario_ref } : {}),
    ...(row.registrado_por_perfil === 'PSICOLOGO' || row.registrado_por_perfil === 'GESTAO'
      ? { registradoPorPerfil: row.registrado_por_perfil }
      : {}),
  };
}

export class MysqlDesistenciaRepository implements DesistenciaRepository {
  private static temTabela = false;
  private readonly arquivo = new FileDesistenciaRepository();

  constructor(private readonly pool: Pool = getMysqlPool()) {}

  /** Só o "sim" fica em cache: a tabela passa a valer assim que a migration rodar. */
  private async tabelaExiste(): Promise<boolean> {
    if (MysqlDesistenciaRepository.temTabela) return true;
    try {
      const [rows] = await this.pool.query<RowDataPacket[]>(
        `SELECT 1 FROM information_schema.tables
          WHERE table_schema = DATABASE() AND table_name = 'clinica_desistencias' LIMIT 1`
      );
      MysqlDesistenciaRepository.temTabela = rows.length > 0;
    } catch {
      return false;
    }
    return MysqlDesistenciaRepository.temTabela;
  }

  async list(organizationId: string): Promise<AuditoriaDesistenciaRecord[]> {
    if (!(await this.tabelaExiste())) return this.arquivo.list(organizationId);
    let linhas = await this.ler(this.pool, organizationId);
    if (!linhas.length) {
      const legado = await this.arquivo.list(organizationId);
      if (legado.length) {
        for (const registro of legado) await this.gravar(this.pool, { ...registro, organizationId }, true);
        linhas = await this.ler(this.pool, organizationId);
      }
    }
    return linhas;
  }

  async save(record: AuditoriaDesistenciaRecord): Promise<void> {
    if (!(await this.tabelaExiste())) return this.arquivo.save(record);
    await this.gravar(this.pool, record, false);
  }

  private async ler(connection: Pool | PoolConnection, organizationId: string): Promise<AuditoriaDesistenciaRecord[]> {
    const [rows] = await connection.query<DesistenciaRow[]>(
      `SELECT ref_core, organizacao_ref, paciente_ref, lead_ref, paciente_nome, psicologo_ref,
              psicologo_nome, motivo, descricao_detalhada, acao_sugestao, data_desistencia,
              reengajado, observacoes_reengajamento, permitir_troca_psicologo,
              registrado_por_usuario_ref, registrado_por_perfil
         FROM clinica_desistencias
        WHERE instituicao_id = ? AND organizacao_ref = ?
        ORDER BY data_desistencia DESC`,
      [instituicaoId(), organizationId]
    );
    return rows.map(toRecord);
  }

  private async gravar(connection: Pool | PoolConnection, record: AuditoriaDesistenciaRecord, importacao: boolean): Promise<void> {
    if (!record.organizationId) throw new Error('A desistência precisa da organização.');
    const valores = [
      rowId('desistencia', record.id),
      instituicaoId(),
      record.organizationId,
      record.id,
      record.pacienteId ?? null,
      record.leadId ?? null,
      record.pacienteNome.slice(0, 255),
      record.psicologoId ?? null,
      record.psicologoNome.slice(0, 255),
      record.motivo,
      record.descricaoDetalhada?.slice(0, 2000) ?? null,
      record.acaoSugestao?.slice(0, 500) ?? null,
      toSqlTimestamp(record.dataDesistencia),
      record.reengajado ? 1 : 0,
      record.observacoesReengajamento?.slice(0, 1000) ?? null,
      record.permitirTrocaPsicologo ? 1 : 0,
      record.registradoPorUsuarioRef ?? null,
      record.registradoPorPerfil ?? null,
    ];
    const colunas = `(id, instituicao_id, organizacao_ref, ref_core, paciente_ref, lead_ref, paciente_nome,
        psicologo_ref, psicologo_nome, motivo, descricao_detalhada, acao_sugestao, data_desistencia,
        reengajado, observacoes_reengajamento, permitir_troca_psicologo,
        registrado_por_usuario_ref, registrado_por_perfil)`;
    const marcadores = 'VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)';
    if (importacao) {
      await connection.execute(`INSERT IGNORE INTO clinica_desistencias ${colunas} ${marcadores}`, valores);
      return;
    }
    // Motivo, data e autor da saída são a prova do registro: depois de
    // gravados, só o reengajamento muda.
    await connection.execute(
      `INSERT INTO clinica_desistencias ${colunas} ${marcadores}
       ON DUPLICATE KEY UPDATE
         lead_ref = COALESCE(lead_ref, VALUES(lead_ref)),
         reengajado = VALUES(reengajado),
         observacoes_reengajamento = VALUES(observacoes_reengajamento)`,
      valores
    );
  }
}

export function getDesistenciaRepository(): DesistenciaRepository {
  return isMysqlConfigured() ? new MysqlDesistenciaRepository() : new FileDesistenciaRepository();
}
