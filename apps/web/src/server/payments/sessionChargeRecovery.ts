import 'server-only';

import type { RowDataPacket } from 'mysql2';
import { getMysqlPool } from '@/server/oci/runtime';
import { instituicaoId } from '@/server/persistence/mysql/mappers';
import { garantirCobrancaDaSessao } from './sessionCharge';

const PRAZO_POS_SESSAO_MS = 3 * 24 * 60 * 60_000;
const FOLGA_MINIMA_MS = 60_000;

/**
 * Recupera sessões concluídas cuja cobrança individual não foi materializada.
 *
 * A conclusão clínica já foi confirmada e não pode ser repetida apenas para
 * reemitir o financeiro. O worker financeiro refaz essa tentativa de modo
 * idempotente depois de uma falha transitória do banco.
 */
export async function recuperarCobrancasPosSessaoPendentes(limit = 100): Promise<{
  created: number; existing: number; failed: number;
}> {
  const [rows] = await getMysqlPool().query<RowDataPacket[]>(
    `SELECT a.id, a.realizado_em
       FROM clinica_agendamentos a
       JOIN clinica_organizacoes o ON o.id = a.organizacao_id
      WHERE a.instituicao_id = ? AND a.status = 'realizado'
        AND COALESCE(a.custeado_pela_empresa, 0) = 0
        AND a.realizado_em IS NOT NULL
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
    const realizedAt = new Date(row.realizado_em).getTime();
    const dueAt = new Date(Math.max(
      realizedAt + PRAZO_POS_SESSAO_MS,
      Date.now() + FOLGA_MINIMA_MS
    )).toISOString();
    const outcome = await garantirCobrancaDaSessao(String(row.id), dueAt);
    if (outcome === 'created') result.created += 1;
    else if (outcome === 'existing') result.existing += 1;
    else result.failed += 1;
  }
  return result;
}
