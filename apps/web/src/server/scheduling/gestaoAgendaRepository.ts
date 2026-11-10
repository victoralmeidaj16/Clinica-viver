import 'server-only';
import type { RowDataPacket } from 'mysql2/promise';
import { getMysqlPool } from '@/server/oci/runtime';
import { fromSqlTimestamp, instituicaoId } from '@/server/persistence/mysql/mappers';
import { custeioDoAgendamentoSql } from '@/server/persistence/mysql/custeioSql';

const JOINS = `FROM clinica_agendamentos a
  JOIN clinica_organizacoes o ON o.id = a.organizacao_id
  JOIN clinica_profissionais pr ON pr.id = a.profissional_id
  JOIN clinica_pacientes pa ON pa.id = a.paciente_id
  LEFT JOIN clinica_convenios conv ON conv.instituicao_id = a.instituicao_id
    AND conv.organizacao_ref = o.ref_core AND conv.ref_core = pa.convenio_ref`;

export async function listarAgendaGestao(organizationId: string, busca: string, pagina: number) {
  const [rows] = await getMysqlPool().query<RowDataPacket[]>(
    `SELECT a.id, a.versao, a.inicio, a.fim, a.modalidade, a.servico_key, a.status,
      COALESCE(pa.nome_social, pa.nome) AS paciente_nome, pr.nome AS profissional_nome,
      conv.nome AS convenio_nome, conv.pacote_sessoes, conv.pacote_sessoes_ciclo,
      pa.custeio_sessoes_cota, pa.custeio_sessoes_ciclo,
      COALESCE((SELECT c.vence_em FROM financeiro_cobrancas c
        WHERE c.instituicao_id = a.instituicao_id AND c.organizacao_ref = o.ref_core
          AND c.sessao_ref IN (a.ref_core, a.sessao_clinica_ref) AND c.status <> 'cancelled'
        ORDER BY c.criado_em DESC LIMIT 1), a.cobranca_vence_em) AS vencimento_cobranca_em,
      (SELECT c.status FROM financeiro_cobrancas c
        WHERE c.instituicao_id = a.instituicao_id AND c.organizacao_ref = o.ref_core
          AND c.sessao_ref IN (a.ref_core, a.sessao_clinica_ref) AND c.status <> 'cancelled'
        ORDER BY c.criado_em DESC LIMIT 1) AS pagamento_status,
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
      id: String(row.id), versao: Number(row.versao), pacienteNome: String(row.paciente_nome), profissionalNome: String(row.profissional_nome),
      inicio: fromSqlTimestamp(row.inicio)!, fim: fromSqlTimestamp(row.fim)!,
      modalidade: row.modalidade as 'online' | 'presencial' | 'telefone', status: String(row.status),
      serviceKey: row.servico_key ? String(row.servico_key) : undefined,
      convenioNome: row.convenio_nome ? String(row.convenio_nome) : undefined,
      custeioCota: row.custeio_sessoes_cota == null ? undefined : Number(row.custeio_sessoes_cota),
      custeioCiclo: row.custeio_sessoes_ciclo as 'mensal' | 'total' | undefined,
      pacoteSessoes: row.pacote_sessoes == null ? undefined : Number(row.pacote_sessoes),
      pacoteSessoesCiclo: row.pacote_sessoes_ciclo as 'mensal' | 'total' | undefined,
      vencimentoCobrancaEm: fromSqlTimestamp(row.vencimento_cobranca_em),
      pagamentoStatus: row.pagamento_status ? String(row.pagamento_status) : undefined,
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

export async function convenioDoAgendamentoGestao(organizationId: string, id: string) {
  const [rows] = await getMysqlPool().query<RowDataPacket[]>(
    `SELECT pa.ref_core AS paciente_ref, conv.ref_core AS convenio_ref, conv.pacote_sessoes ${JOINS}
      WHERE a.instituicao_id = ? AND o.ref_core = ? AND (a.id = ? OR a.ref_core = ?) LIMIT 1`,
    [instituicaoId(), organizationId, id, id]
  );
  return rows[0] ? {
    pacienteId: String(rows[0].paciente_ref), convenioId: rows[0].convenio_ref ? String(rows[0].convenio_ref) : undefined,
    pacoteSessoes: rows[0].pacote_sessoes == null ? undefined : Number(rows[0].pacote_sessoes),
  } : null;
}
