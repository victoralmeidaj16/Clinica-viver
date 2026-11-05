import 'server-only';
import type { Pool, PoolConnection } from 'mysql2/promise';
import type { PatientAccessibility } from '@/lib/patientAccessibility';
import { getMysqlPool } from '@/server/oci/runtime';
import { instituicaoId } from './mappers';

export async function savePatientAccessibility(organizationId: string, patientId: string,
  value: PatientAccessibility | null | undefined, connection: Pool | PoolConnection = getMysqlPool()) {
  if (value === undefined) return;
  await connection.execute(
    `UPDATE clinica_pacientes pa JOIN clinica_organizacoes o ON o.id = pa.organizacao_id
        SET pa.acessibilidade = CAST(? AS JSON)
      WHERE pa.instituicao_id = ? AND o.ref_core = ? AND pa.ref_core = ?`,
    [JSON.stringify(value), instituicaoId(), organizationId, patientId],
  );
}
