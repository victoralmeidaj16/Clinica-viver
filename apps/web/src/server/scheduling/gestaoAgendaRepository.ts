import 'server-only';
import type { RowDataPacket } from 'mysql2/promise';
import { getMysqlPool } from '@/server/oci/runtime';
import { instituicaoId } from '@/server/persistence/mysql/mappers';
import { custeioDoAgendamentoSql } from '@/server/persistence/mysql/custeioSql';

const JOINS = `FROM clinica_agendamentos a
  JOIN clinica_organizacoes o ON o.id = a.organizacao_id
  JOIN clinica_profissionais pr ON pr.id = a.profissional_id
  JOIN clinica_pacientes pa ON pa.id = a.paciente_id
  LEFT JOIN clinica_convenios conv ON conv.instituicao_id = a.instituicao_id
    AND conv.organizacao_ref = o.ref_core AND conv.ref_core = pa.convenio_ref`;

export async function listarAgendaGestao(organizationId: string, busca: string, pagina: number) {
  const [rows] = await getMysqlPool().query<RowDataPacket[]>(
    `SELECT a.id, a.inicio, a.fim, a.modalidade, a.status,
      COALESCE(pa.nome_social, pa.nome) AS paciente_nome, pr.nome AS profissional_nome,
      conv.nome AS convenio_nome,
      ${custeioDoAgendamentoSql({ agendamento: 'a', paciente: 'pa', convenio: 'conv' })} AS custeado
      ${JOINS}
      WHERE a.instituicao_id = ? AND o.ref_core = ? AND a.status IN ('agendado', 'confirmado')
        AND (COALESCE(pa.nome_social, pa.nome) LIKE ? OR pr.nome LIKE ?)
      -- Próximas sessões primeiro (da mais perto para a mais longe); as já
      -- encerradas sem conclusão vão para o fim, das mais recentes às antigas.
      ORDER BY a.fim < UTC_TIMESTAMP(3),
        CASE WHEN a.fim >= UTC_TIMESTAMP(3) THEN a.inicio END,
        a.inicio DESC, a.id
      LIMIT 51 OFFSET ?`,
    [instituicaoId(), organizationId, `%${busca}%`, `%${busca}%`, pagina * 50]
  );
  return {
    temMais: rows.length > 50,
    appointments: rows.slice(0, 50).map((row) => ({
      id: String(row.id), pacienteNome: String(row.paciente_nome), profissionalNome: String(row.profissional_nome),
      inicio: new Date(row.inicio).toISOString(), fim: new Date(row.fim).toISOString(),
      modalidade: row.modalidade as 'online' | 'presencial' | 'telefone', status: String(row.status),
      convenioNome: row.convenio_nome ? String(row.convenio_nome) : undefined,
      custeadoPelaEmpresa: Boolean(row.custeado),
    })),
  };
}

export async function profissionalDoAgendamentoGestao(organizationId: string, id: string) {
  const [rows] = await getMysqlPool().query<RowDataPacket[]>(
    `SELECT pr.ref_core AS profissional_ref ${JOINS}
      WHERE a.instituicao_id = ? AND o.ref_core = ? AND (a.id = ? OR a.ref_core = ?) LIMIT 1`,
    [instituicaoId(), organizationId, id, id]
  );
  return rows[0] ? String(rows[0].profissional_ref) : null;
}
