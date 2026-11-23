import 'server-only';
import type { RowDataPacket } from 'mysql2';
import { getMysqlPool } from '@/server/oci/runtime';
import { fromSqlTimestamp, instituicaoId } from '@/server/persistence/mysql/mappers';
import type { AgendamentoDoVinculo } from '@/server/application/notificacoes';

/**
 * Agendamentos não cancelados dos pacientes informados, com o profissional e a
 * data de criação. Serve ao aviso de 48h sem primeiro agendamento
 * (especificação final, 7.03); quem decide o que conta é a função pura.
 */
export async function agendamentosDosPacientes(
  organizationId: string,
  pacienteRefs: readonly string[]
): Promise<AgendamentoDoVinculo[]> {
  const refs = [...new Set(pacienteRefs)].filter(Boolean);
  if (!refs.length) return [];
  const [rows] = await getMysqlPool().query<RowDataPacket[]>(
    `SELECT pa.ref_core AS paciente_ref, p.ref_core AS profissional_ref, a.criado_em
       FROM clinica_agendamentos a
       JOIN clinica_profissionais p ON p.id = a.profissional_id
       JOIN clinica_organizacoes o ON o.id = p.organizacao_id
       JOIN clinica_pacientes pa ON pa.id = a.paciente_id
      WHERE a.instituicao_id = ? AND o.ref_core = ? AND a.status <> 'cancelado'
        AND pa.ref_core IN (?)`,
    [instituicaoId(), organizationId, refs]
  );
  return rows.map((row) => ({
    pacienteRef: String(row.paciente_ref),
    profissionalRef: String(row.profissional_ref),
    criadoEm: fromSqlTimestamp(row.criado_em)!,
  }));
}
