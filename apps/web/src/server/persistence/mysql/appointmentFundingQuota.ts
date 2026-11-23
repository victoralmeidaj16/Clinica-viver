import 'server-only';
import type { PoolConnection } from 'mysql2/promise';
import type { RowDataPacket } from 'mysql2';
import { ApplicationError } from '@/server/application/http';
import { instituicaoId } from './mappers';
import { custeioEfetivoSql, dentroDoCicloSql } from './custeioSql';

/** A linha do paciente serializa decisões de cota inclusive entre agendas diferentes. */
export async function appointmentFundingQuotaAvailable(
  connection: PoolConnection, appointmentId: string, proposedStart: Date | null, assigningCompany = false
) {
  const [rows] = await connection.query<RowDataPacket[]>(
    `SELECT p.id, a.custeado_pela_empresa, p.convenio_ref,
            ${dentroDoCicloSql('p', 'c', 'a.inicio', 'COALESCE(?, a.inicio)')} AS mesmo_ciclo
       FROM clinica_agendamentos a
       JOIN clinica_pacientes p ON p.id = a.paciente_id AND p.organizacao_id = a.organizacao_id
       JOIN clinica_organizacoes o ON o.id = a.organizacao_id
       LEFT JOIN clinica_convenios c ON c.instituicao_id = a.instituicao_id
        AND c.organizacao_ref = o.ref_core AND c.ref_core = p.convenio_ref
      WHERE a.instituicao_id = ? AND a.id = ? FOR UPDATE`,
    [proposedStart, instituicaoId(), appointmentId],
  );
  const row = rows[0];
  const covered = Boolean(row?.custeado_pela_empresa);
  if (!covered && !assigningCompany) return true;
  if (!row?.convenio_ref) return false;
  if (covered && Number(row.mesmo_ciclo) === 1) return true;

  const reference = 'COALESCE(proposta.inicio, a.inicio)';
  const [quota] = await connection.query<RowDataPacket[]>(
    `SELECT ${custeioEfetivoSql({ paciente: 'p', convenio: 'c', agendamento: 'a', referencia: reference, ignorarPadrao: true })} AS disponivel
       FROM clinica_agendamentos a
       JOIN clinica_pacientes p ON p.id = a.paciente_id AND p.organizacao_id = a.organizacao_id
       JOIN clinica_organizacoes o ON o.id = a.organizacao_id
       JOIN clinica_convenios c ON c.instituicao_id = a.instituicao_id
        AND c.organizacao_ref = o.ref_core AND c.ref_core = p.convenio_ref
       CROSS JOIN (SELECT CAST(? AS DATETIME(3)) AS inicio) proposta
      WHERE a.instituicao_id = ? AND a.id = ?`,
    [proposedStart, instituicaoId(), appointmentId],
  );
  return Number(quota[0]?.disponivel) === 1;
}

export async function assertRescheduledFundingQuota(connection: PoolConnection, appointmentId: string, start: Date) {
  if (!await appointmentFundingQuotaAvailable(connection, appointmentId, start)) {
    throw new ApplicationError('APPOINTMENT_FUNDING_QUOTA_EXCEEDED',
      'Esta sessão não cabe na cota da empresa para a data escolhida. Confira o vínculo e o saldo do convênio.', 409);
  }
}
