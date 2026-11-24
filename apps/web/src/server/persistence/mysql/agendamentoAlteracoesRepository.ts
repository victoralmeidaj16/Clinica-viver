import 'server-only';
import { randomUUID } from 'node:crypto';
import type { PoolConnection, RowDataPacket } from 'mysql2/promise';
import type { AlteracaoAgendamento, AlteracaoAgendamentoComPaciente, MudancaAgendamento } from '@/lib/alteracoesAgendamento';
import { getMysqlPool } from '@/server/oci/runtime';
import { fromSqlTimestamp, instituicaoId } from './mappers';

export function tabelaDeAlteracoesAusente(error: unknown) {
  return typeof error === 'object' && error !== null && 'code' in error && error.code === 'ER_NO_SUCH_TABLE';
}

interface RegistroAlteracao {
  organizacaoRef: string;
  agendamentoId: string;
  profissionalRef: string;
  usuarioRef: string;
  nome?: string;
  alteradoEm: Date;
  mudancas: MudancaAgendamento[];
}

export async function registrarAlteracaoAgendamento(executor: Pick<PoolConnection, 'execute'>, linha: RegistroAlteracao) {
  await executor.execute(
    `INSERT INTO clinica_agendamentos_alteracoes
      (id, instituicao_id, organizacao_ref, agendamento_id, profissional_ref, alterado_por_usuario_ref,
       alterado_por_nome, alterado_em, mudancas)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [randomUUID(), instituicaoId(), linha.organizacaoRef, linha.agendamentoId, linha.profissionalRef,
      linha.usuarioRef, linha.nome ?? null, linha.alteradoEm, JSON.stringify(linha.mudancas)]
  );
}

function alteracao(row: RowDataPacket): AlteracaoAgendamento {
  return {
    id: row.id, agendamentoId: row.agendamento_id, profissionalRef: row.profissional_ref,
    alteradoPorNome: row.alterado_por_nome ?? undefined, alteradoEm: fromSqlTimestamp(row.alterado_em)!,
    mudancas: typeof row.mudancas === 'string' ? JSON.parse(row.mudancas) : row.mudancas,
  };
}

const agendamento = `FROM clinica_agendamentos_alteracoes h
  JOIN clinica_agendamentos a ON a.id = h.agendamento_id AND a.instituicao_id = h.instituicao_id
  JOIN clinica_organizacoes o ON o.id = a.organizacao_id AND o.ref_core = h.organizacao_ref`;

export async function alteracoesDoAgendamento(organizationId: string, agendamentoId: string): Promise<AlteracaoAgendamento[]> {
  try {
    const [rows] = await getMysqlPool().query<RowDataPacket[]>(
      `SELECT h.* ${agendamento}
        WHERE h.instituicao_id = ? AND h.organizacao_ref = ? AND (a.id = ? OR a.ref_core = ?)
        ORDER BY h.alterado_em DESC`, [instituicaoId(), organizationId, agendamentoId, agendamentoId]
    );
    return rows.map(alteracao);
  } catch (error) {
    if (tabelaDeAlteracoesAusente(error)) return [];
    throw error;
  }
}

export async function alteracoesRecentesDoProfissional(
  organizationId: string, profissionalRef: string, desde: Date
): Promise<AlteracaoAgendamentoComPaciente[]> {
  const [rows] = await getMysqlPool().query<RowDataPacket[]>(
    `SELECT h.*, a.inicio, COALESCE(NULLIF(p.nome_social, ''), p.nome) AS paciente_nome ${agendamento}
      JOIN clinica_pacientes p ON p.id = a.paciente_id AND p.instituicao_id = h.instituicao_id
      WHERE h.instituicao_id = ? AND h.organizacao_ref = ? AND h.profissional_ref = ? AND h.alterado_em >= ?
      ORDER BY h.alterado_em DESC`, [instituicaoId(), organizationId, profissionalRef, desde]
  );
  return rows.map(row => ({ ...alteracao(row), pacienteNome: row.paciente_nome, inicio: fromSqlTimestamp(row.inicio)! }));
}
