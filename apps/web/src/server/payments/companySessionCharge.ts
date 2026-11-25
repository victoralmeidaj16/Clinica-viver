import 'server-only';
import { randomUUID } from 'node:crypto';
import type { PoolConnection, RowDataPacket } from 'mysql2/promise';
import { descricaoFiscalDaSessao } from '@/lib/sessionReference';
import { instanteSql, instituicaoId, rowId } from '@/server/persistence/mysql/mappers';

interface SessaoCusteada {
  agendamentoId: string;
  organizacao: string;
  convenio: string;
  sessao: string;
  paciente: string;
  profissional: string;
  inicio: Date;
  confirmadaEm: Date;
}

/** O chamador mantém o agendamento travado até concluir a transação. */
export async function registrarCobrancaContratual(
  connection: PoolConnection,
  dados: SessaoCusteada,
  valorCentavos: number | null
) {
  if (valorCentavos === null) {
    await connection.execute(
      'UPDATE clinica_agendamentos SET valor_contrato_pendente = 1 WHERE instituicao_id = ? AND id = ?',
      [instituicaoId(), dados.agendamentoId]
    );
    return;
  }
  if (!Number.isSafeInteger(valorCentavos) || valorCentavos <= 0) throw new Error('Valor contratual inválido.');
  const ref = `charge-company-session-${randomUUID()}`;
  await connection.execute(
    `INSERT INTO financeiro_cobrancas
       (id, instituicao_id, organizacao_ref, ref_core, sessao_ref, paciente_ref,
        profissional_ref, emitida_em, vence_em, valor_centavos, status,
        descricao, fatura_convenio_ref, convenio_ref, criado_em, atualizado_em)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'pending', ?, NULL, ?, CURRENT_TIMESTAMP(3), CURRENT_TIMESTAMP(3))`,
    [rowId('cobranca', ref), instituicaoId(), dados.organizacao, ref, dados.sessao, dados.paciente,
      dados.profissional, dados.confirmadaEm, dados.confirmadaEm, valorCentavos,
      descricaoFiscalDaSessao(dados.inicio.toISOString()), dados.convenio]
  );
  await connection.execute(
    `UPDATE clinica_sessoes SET cobranca_ref = ?, atualizado_em = CURRENT_TIMESTAMP(3)
      WHERE instituicao_id = ? AND organizacao_ref = ? AND ref_core = ?`,
    [ref, instituicaoId(), dados.organizacao, dados.sessao]
  );
}

/** Liquida a pendência de preço na mesma transação que grava o valor do contrato. */
export async function precificarSessoesPendentes(
  connection: PoolConnection, organizacao: string, convenio: string, centavos: number
) {
  const [rows] = await connection.query<RowDataPacket[]>(
    `SELECT a.id, a.inicio, COALESCE(a.realizado_em, s.criado_em) AS confirmada_em,
            s.ref_core, s.paciente_ref, s.profissional_principal_ref
       FROM clinica_agendamentos a
       JOIN clinica_organizacoes o ON o.id = a.organizacao_id AND o.instituicao_id = a.instituicao_id
       JOIN clinica_sessoes s ON s.instituicao_id = a.instituicao_id
         AND s.organizacao_ref = o.ref_core AND s.ref_core = a.sessao_clinica_ref
      WHERE a.instituicao_id = ? AND o.ref_core = ? AND a.custeio_convenio_ref = ?
        AND a.valor_contrato_pendente = 1 AND a.custeado_pela_empresa = 1 AND a.status = 'realizado'
      ORDER BY a.id FOR UPDATE`, [instituicaoId(), organizacao, convenio]
  );
  for (const row of rows) {
    await registrarCobrancaContratual(connection, {
      organizacao, convenio, agendamentoId: row.id, sessao: row.ref_core,
      paciente: row.paciente_ref, profissional: row.profissional_principal_ref,
      inicio: instanteSql(row.inicio), confirmadaEm: instanteSql(row.confirmada_em),
    }, centavos);
    await connection.execute(
      'UPDATE clinica_agendamentos SET valor_contrato_pendente = 0 WHERE instituicao_id = ? AND id = ?',
      [instituicaoId(), row.id]
    );
  }
}
