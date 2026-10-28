import 'server-only';

import type { RowDataPacket } from 'mysql2';
import { getMysqlPool } from '@/server/oci/runtime';
import { fromSqlTimestamp, instituicaoId } from '@/server/persistence/mysql/mappers';
import { garantirCobrancaDaSessao } from './sessionCharge';
import { custeioDoAgendamentoSql } from '@/server/persistence/mysql/custeioSql';

const PRAZO_POS_SESSAO_MS = 3 * 24 * 60 * 60_000;
const FOLGA_MINIMA_MS = 60_000;

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
  const [rows] = await getMysqlPool().query<RowDataPacket[]>(
    `SELECT a.id, a.inicio, a.realizado_em, a.cobranca_vence_em
       FROM clinica_agendamentos a
       JOIN clinica_organizacoes o ON o.id = a.organizacao_id
       JOIN clinica_pacientes pa ON pa.id = a.paciente_id
       LEFT JOIN clinica_convenios conv
         ON conv.instituicao_id = pa.instituicao_id AND conv.organizacao_ref = o.ref_core
        AND conv.ref_core = pa.convenio_ref
      WHERE a.instituicao_id = ?
        AND ((a.status = 'realizado' AND a.realizado_em IS NOT NULL)
          OR a.status IN ('agendado', 'confirmado'))
        AND ${custeioDoAgendamentoSql({ agendamento: 'a', paciente: 'pa', convenio: 'conv' })} = 0
        AND NOT EXISTS (
          SELECT 1 FROM financeiro_cobrancas c
           WHERE c.instituicao_id = a.instituicao_id AND c.organizacao_ref = o.ref_core
             AND c.sessao_ref IN (a.ref_core, COALESCE(a.sessao_clinica_ref, a.ref_core))
             AND c.status <> 'cancelled'
        )
      ORDER BY a.realizado_em, a.id
      LIMIT ?`,
    [instituicaoId(), Math.max(1, Math.min(limit, 500))]
  );

  const result = { created: 0, existing: 0, failed: 0 };
  for (const row of rows) {
    const realizedAt = fromSqlTimestamp(row.realizado_em ?? null);
    const requestedDueAt = fromSqlTimestamp(row.cobranca_vence_em ?? null);
    const dueAt = requestedDueAt ?? (realizedAt
      ? new Date(Math.max(Date.parse(realizedAt) + PRAZO_POS_SESSAO_MS, Date.now() + FOLGA_MINIMA_MS)).toISOString()
      : fromSqlTimestamp(row.inicio));
    if (!dueAt) { result.failed += 1; continue; }
    const outcome = await garantirCobrancaDaSessao(String(row.id), dueAt);
    if (outcome === 'created') result.created += 1;
    else if (outcome === 'existing') result.existing += 1;
    else result.failed += 1;
  }
  return result;
}
