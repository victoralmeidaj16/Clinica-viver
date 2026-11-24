import 'server-only';

import type { RowDataPacket } from 'mysql2';
import type { Pool, PoolConnection } from 'mysql2/promise';

/**
 * Responsável financeiro do vínculo atual do paciente, em SQL (6.03 e 6.04).
 *
 * A cobrança e o link de pagamento rodam consultas próprias sobre
 * `clinica_pacientes`; o responsável mora no pedido da captação. A subconsulta
 * pega o pedido mais recente do paciente — a mesma regra que essas consultas já
 * usam para CPF e telefone da triagem.
 *
 * Antes da migration 088 a coluna não existe, e citar uma coluna inexistente
 * derruba a consulta inteira — o link de pagamento pararia para todos. Por
 * isso a presença é conferida antes, e a subconsulta vira `NULL` sem ela.
 */

let disponivel = false;

export async function responsavelFinanceiroDisponivel(connection: Pool | PoolConnection): Promise<boolean> {
  if (disponivel) return true;
  try {
    const [rows] = await connection.query<RowDataPacket[]>(
      `SELECT 1 FROM information_schema.columns
        WHERE table_schema = DATABASE() AND table_name = 'clinica_triagens_pacientes'
          AND column_name = 'responsavel_financeiro' LIMIT 1`
    );
    disponivel = rows.length > 0;
  } catch {
    return false;
  }
  return disponivel;
}

/** JSON do responsável do vínculo atual do paciente `paciente`, ou `NULL`. */
export function responsavelDoPacienteSql(ativo: boolean, paciente = 'pa', organizacao = 'o'): string {
  if (!ativo) return 'NULL';
  return `(SELECT rf.responsavel_financeiro FROM clinica_triagens_pacientes rf
            WHERE rf.instituicao_id = ${paciente}.instituicao_id AND rf.organizacao_ref = ${organizacao}.ref_core
              AND rf.paciente_ref = ${paciente}.ref_core
            ORDER BY rf.atualizado_em DESC LIMIT 1)`;
}

/** CPF do responsável (só dígitos, como gravado), para comparar com o digitado. */
export function cpfDoResponsavelSql(ativo: boolean, paciente = 'pa', organizacao = 'o'): string {
  if (!ativo) return 'NULL';
  return `JSON_UNQUOTE(JSON_EXTRACT(${responsavelDoPacienteSql(true, paciente, organizacao)}, '$.cpf'))`;
}
