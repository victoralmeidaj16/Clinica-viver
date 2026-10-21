import 'server-only';

import { randomUUID } from 'node:crypto';
import type { RowDataPacket } from 'mysql2';
import { descricaoFiscalDaSessao } from '@/lib/sessionReference';
import { getMysqlPool } from '@/server/oci/runtime';
import { custeioEfetivoSql } from '@/server/persistence/mysql/custeioSql';
import { instituicaoId, rowId } from '@/server/persistence/mysql/mappers';
import { cancelarCobrancaDaSessao } from './sessionChargeCancellation';

export interface ResultadoTransferencia {
  transferidas: number;
  mantidas: number;
}

/**
 * Passa para a empresa as sessões que o vínculo novo passou a cobrir.
 *
 * A cobrança individual nasce no agendamento. Quando a gestão vincula o
 * paciente ao convênio depois disso, aquela cobrança continuava valendo — e,
 * na realização, uma cobrança existente decide sozinha que quem paga é o
 * paciente. As sessões ficavam como "pagamento individual" na aba do convênio
 * e nunca entravam no que a empresa tem a faturar.
 *
 * Só sai daqui o que o paciente ainda não pagou: cobrança paga, em fatura ou
 * com pagamento confirmado no provedor fica onde está, porque trocá-la cobraria
 * o mesmo atendimento duas vezes. As sessões são percorridas em ordem, para
 * que a cota limitada seja consumida pelas mais antigas primeiro.
 */
export async function transferirCobrancasParaEmpresa(
  organizationId: string,
  patientId: string
): Promise<ResultadoTransferencia> {
  const resultado: ResultadoTransferencia = { transferidas: 0, mantidas: 0 };
  const [candidatas] = await getMysqlPool().query<RowDataPacket[]>(
    `SELECT a.id
       FROM clinica_agendamentos a
       JOIN clinica_pacientes pa ON pa.id = a.paciente_id
       JOIN clinica_organizacoes o ON o.id = a.organizacao_id
      WHERE a.instituicao_id = ? AND o.ref_core = ? AND pa.ref_core = ?
        AND a.status IN ('agendado', 'confirmado', 'realizado')
        AND COALESCE(a.custeado_pela_empresa, 0) = 0
        AND EXISTS (SELECT 1 FROM financeiro_cobrancas c
                     WHERE c.instituicao_id = a.instituicao_id AND c.organizacao_ref = o.ref_core
                       AND c.sessao_ref IN (a.ref_core, a.sessao_clinica_ref)
                       AND c.fatura_convenio_ref IS NULL
                       AND c.status IN ('draft', 'pending', 'overdue'))
      ORDER BY a.inicio, a.id`,
    [instituicaoId(), organizationId, patientId]
  );

  for (const candidata of candidatas) {
    try {
      if (await transferirSessao(String(candidata.id))) resultado.transferidas += 1;
      else resultado.mantidas += 1;
    } catch (error) {
      resultado.mantidas += 1;
      console.error(`[convenio] Falha ao transferir a sessão ${String(candidata.id)} para a empresa:`,
        error instanceof Error ? error.message : error);
    }
  }
  return resultado;
}

async function transferirSessao(agendamentoId: string): Promise<boolean> {
  // A conta ignora a decisão gravada de propósito: ela foi tomada por causa da
  // cobrança individual que estamos desfazendo, não pelo acordo.
  if (!await empresaCobre(agendamentoId)) return false;
  if (await cancelarCobrancaDaSessao(agendamentoId) !== 'cancelled') return false;

  const connection = await getMysqlPool().getConnection();
  try {
    await connection.beginTransaction();
    const [rows] = await connection.query<RowDataPacket[]>(
      `SELECT a.status, a.inicio, a.sessao_clinica_ref, a.valor_centavos,
              pr.valor_sessao_centavos, o.ref_core AS organizacao_ref,
              pa.ref_core AS paciente_ref, pr.ref_core AS profissional_ref
         FROM clinica_agendamentos a
         JOIN clinica_organizacoes o ON o.id = a.organizacao_id
         JOIN clinica_pacientes pa ON pa.id = a.paciente_id
         JOIN clinica_profissionais pr ON pr.id = a.profissional_id
        WHERE a.instituicao_id = ? AND a.id = ? LIMIT 1 FOR UPDATE`,
      [instituicaoId(), agendamentoId]
    );
    const agendamento = rows[0];
    // Sessão futura não precisa de mais nada: sem cobrança individual, a
    // realização calcula o custeio e emite a cobrança da empresa.
    if (!agendamento || agendamento.status !== 'realizado' || !agendamento.sessao_clinica_ref) {
      await connection.commit();
      return true;
    }

    const valorCents = Number(agendamento.valor_centavos ?? agendamento.valor_sessao_centavos);
    if (!Number.isSafeInteger(valorCents) || valorCents <= 0) {
      throw new Error('O valor da sessão custeada não está configurado no perfil profissional.');
    }
    const agora = new Date();
    const sessionRef = String(agendamento.sessao_clinica_ref);
    const chargeRef = `charge-company-session-${randomUUID()}`;
    await connection.execute(
      `UPDATE clinica_agendamentos SET custeado_pela_empresa = 1, versao = versao + 1, atualizado_em = ?
        WHERE instituicao_id = ? AND id = ?`,
      [agora, instituicaoId(), agendamentoId]
    );
    await connection.execute(
      `INSERT INTO financeiro_cobrancas
        (id, instituicao_id, organizacao_ref, ref_core, sessao_ref, paciente_ref,
         profissional_ref, emitida_em, vence_em, valor_centavos, status,
         descricao, fatura_convenio_ref, criado_em, atualizado_em)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'pending', ?, NULL, ?, ?)`,
      [rowId('cobranca', chargeRef), instituicaoId(), agendamento.organizacao_ref,
        chargeRef, sessionRef, agendamento.paciente_ref, agendamento.profissional_ref,
        agora, agora, valorCents, descricaoFiscalDaSessao(new Date(agendamento.inicio).toISOString()),
        agora, agora]
    );
    await connection.execute(
      `UPDATE clinica_sessoes SET cobranca_ref = ?, atualizado_em = ?
        WHERE instituicao_id = ? AND organizacao_ref = ? AND ref_core = ?`,
      [chargeRef, agora, instituicaoId(), agendamento.organizacao_ref, sessionRef]
    );
    await connection.commit();
    return true;
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
}

async function empresaCobre(agendamentoId: string): Promise<boolean> {
  const [rows] = await getMysqlPool().query<RowDataPacket[]>(
    `SELECT ${custeioEfetivoSql({ paciente: 'pa', convenio: 'conv', agendamento: 'a', referencia: 'a.inicio' })}
              AS custeado
       FROM clinica_agendamentos a
       JOIN clinica_organizacoes o ON o.id = a.organizacao_id
       JOIN clinica_pacientes pa ON pa.id = a.paciente_id
       LEFT JOIN clinica_convenios conv
         ON conv.instituicao_id = pa.instituicao_id
        AND conv.organizacao_ref = o.ref_core AND conv.ref_core = pa.convenio_ref
      WHERE a.instituicao_id = ? AND a.id = ? LIMIT 1`,
    [instituicaoId(), agendamentoId]
  );
  return Boolean(rows[0] && Number(rows[0].custeado) === 1);
}
