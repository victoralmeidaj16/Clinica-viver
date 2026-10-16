import 'server-only';

import type { RowDataPacket } from 'mysql2';
import { getMysqlPool, isMysqlConfigured } from '@/server/oci/runtime';
import { instituicaoId } from '@/server/persistence/mysql/mappers';

/** Contas já mescladas precisam de revisão humana antes de abrir dados profissionais. */
export async function psychologistAccountIsAmbiguous(userId: string): Promise<boolean> {
  if (!isMysqlConfigured()) return false;
  const [rows] = await getMysqlPool().query<RowDataPacket[]>(
    `SELECT ref_core FROM clinica_cadastros_psicologos
      WHERE instituicao_id = ? AND usuario_ref = ? LIMIT 2`,
    [instituicaoId(), userId]
  );
  return rows.length > 1;
}
