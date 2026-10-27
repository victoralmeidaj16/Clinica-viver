import 'server-only';
import type { PoolConnection, RowDataPacket } from 'mysql2/promise';
import { ApplicationError } from '@/server/application/http';
import { instituicaoId } from './mappers';
import { CPF_CADASTRO_SQL } from './patientCpfSql';

/** A organização deve estar travada antes desta verificação e da gravação. */
export async function assertPatientCpfAvailable(connection: PoolConnection, organizationId: string, patientId: string, cpf: string) {
  const [rows] = await connection.query<RowDataPacket[]>(
    `SELECT pa.id FROM clinica_pacientes pa JOIN clinica_organizacoes o ON o.id = pa.organizacao_id
      WHERE pa.instituicao_id = ? AND o.ref_core = ? AND (pa.ref_core IS NULL OR pa.ref_core <> ?)
        AND (${CPF_CADASTRO_SQL} = ? OR (${CPF_CADASTRO_SQL} IS NULL AND EXISTS (
          SELECT 1 FROM clinica_triagens_pacientes t WHERE t.instituicao_id = pa.instituicao_id
            AND t.organizacao_ref = o.ref_core AND t.paciente_ref = pa.ref_core
            AND REPLACE(REPLACE(REPLACE(COALESCE(t.cpf, ''), '.', ''), '-', ''), ' ', '') = ?)))
      LIMIT 1 FOR UPDATE`,
    [instituicaoId(), organizationId, patientId, cpf, cpf]
  );
  if (rows.length) throw new ApplicationError('CONFLICT', 'Este CPF já está cadastrado. Revise o cadastro existente.', 409);
}
