import 'server-only';
import type { RowDataPacket } from 'mysql2';
import type { Pool, PoolConnection } from 'mysql2/promise';
import { instituicaoId } from '@/server/persistence/mysql/mappers';

/** Inclui todas as sessões do grupo, mesmo quando a sessão remarcada não é a titular. */
export async function hasPendingChargeDueReset(connection: Pool | PoolConnection, chargeIds: string[]): Promise<boolean> {
  if (!chargeIds.length) return false;
  const [rows] = await connection.query<RowDataPacket[]>(
    `SELECT id FROM financeiro_ajustes_vencimento
      WHERE instituicao_id = ? AND situacao = 'pending'
        AND (${chargeIds.map(() => "JSON_CONTAINS(plano, JSON_QUOTE(?), '$.affectedChargeIds')").join(' OR ')})
      LIMIT 1 FOR UPDATE`,
    [instituicaoId(), ...chargeIds]
  );
  return rows.length > 0;
}
