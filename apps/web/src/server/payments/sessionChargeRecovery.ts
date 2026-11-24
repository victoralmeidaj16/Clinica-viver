import 'server-only';

import type { RowDataPacket } from 'mysql2';
import { getMysqlPool } from '@/server/oci/runtime';
import { fromSqlTimestamp, instituicaoId } from '@/server/persistence/mysql/mappers';
import { garantirCobrancaDaSessao } from './sessionCharge';
import { custeioDoAgendamentoSql } from '@/server/persistence/mysql/custeioSql';

const PRAZO_POS_SESSAO_MS = 3 * 24 * 60 * 60_000;
const FOLGA_MINIMA_MS = 60_000;

async function recuperarCobranca(row: RowDataPacket) {
  const realizedAt = fromSqlTimestamp(row.realizado_em ?? null);
  const requestedDueAt = fromSqlTimestamp(row.cobranca_vence_em ?? null);
  const dueAt = requestedDueAt ?? (realizedAt
    ? new Date(Math.max(Date.parse(realizedAt) + PRAZO_POS_SESSAO_MS, Date.now() + FOLGA_MINIMA_MS)).toISOString()
    : fromSqlTimestamp(row.inicio));
  if (!dueAt || !Number.isFinite(Date.parse(dueAt))) return 'failed';
  return garantirCobrancaDaSessao(String(row.id), dueAt);
}

/**
 * Recupera cobranças ausentes, inclusive de agendamentos ainda não realizados.
 *
 * A conclusão clínica já foi confirmada e não pode ser repetida apenas para
 * reemitir o financeiro. O worker financeiro refaz essa tentativa de modo
 * idempotente depois de uma falha transitória do banco.
 */
export async function recuperarCobrancasPosSessaoPendentes(limit = 100): Promise<{
  created: number; existing: number; failed: number;
}> {
  const pool = getMysqlPool();
  const [rows] = await pool.query<RowDataPacket[]>(
    `SELECT a.id, a.inicio, a.realizado_em, a.cobranca_vence_em
       FROM clinica_agendamentos a
       JOIN clinica_organizacoes o ON o.id = a.organizacao_id
       JOIN clinica_pacientes pa ON pa.id = a.paciente_id
       LEFT JOIN clinica_convenios conv
         ON conv.instituicao_id = pa.instituicao_id AND conv.organizacao_ref = o.ref_core
        AND conv.ref_core = pa.convenio_ref
      WHERE a.instituicao_id = ?
        AND a.pacote_id IS NULL AND a.custeio_aguarda_autorizacao=0 AND a.valor_centavos > 0 AND a.ref_core IS NOT NULL
        AND ((a.status = 'realizado' AND a.realizado_em IS NOT NULL)
          OR a.status IN ('agendado', 'confirmado'))
        AND ${custeioDoAgendamentoSql({ agendamento: 'a', paciente: 'pa', convenio: 'conv' })} = 0
        AND NOT EXISTS (
          SELECT 1 FROM financeiro_cobrancas c
           WHERE c.instituicao_id = a.instituicao_id AND c.organizacao_ref = o.ref_core
             AND c.sessao_ref IN (a.ref_core, COALESCE(a.sessao_clinica_ref, a.ref_core))
             AND c.status <> 'cancelled'
        )
      ORDER BY COALESCE(a.cobranca_recuperacao_tentada_em, a.criado_em), a.id
      LIMIT ?`,
    [instituicaoId(), Math.max(1, Math.min(limit, 500))]
  );

  const result = { created: 0, existing: 0, failed: 0 };
  const retryIds: string[] = [];
  for (const row of rows) {
    const outcome = await recuperarCobranca(row).catch(() => 'failed');
    if (outcome === 'created') result.created += 1;
    else if (outcome === 'existing') result.existing += 1;
    else {
      retryIds.push(String(row.id));
      if (outcome === 'failed') result.failed += 1;
    }
  }
  if (retryIds.length) {
    // As falhas voltam ao fim da fila sem alterar a data da última edição da sessão.
    await pool.query(
      `UPDATE clinica_agendamentos SET cobranca_recuperacao_tentada_em = CURRENT_TIMESTAMP(3),
              atualizado_em = atualizado_em
        WHERE instituicao_id = ? AND id IN (?)`,
      [instituicaoId(), retryIds]
    );
  }
  return result;
}
