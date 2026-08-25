import 'server-only';

import { randomUUID } from 'node:crypto';
import type { ResultSetHeader, RowDataPacket } from 'mysql2';
import type { PoolConnection } from 'mysql2/promise';
import { decideSessionCharge } from '@/lib/sessionChargeRules';
import { descricaoFiscalDaSessao } from '@/lib/sessionReference';
import { getMysqlPool } from '@/server/oci/runtime';
import {
  fromSqlTimestamp,
  instituicaoId,
  rowId,
  toSqlTimestamp,
} from '@/server/persistence/mysql/mappers';

type ChargeOutcome = 'created' | 'existing' | 'skipped' | 'failed';
type CancelOutcome = 'cancelled' | 'kept' | 'not_found' | 'failed';

/**
 * Materializa a cobrança operacional assim que o agendamento existe.
 *
 * A linha do agendamento funciona como mutex: este módulo e o checkout travam
 * a mesma linha, portanto duas requisições concorrentes não criam duplicatas.
 * Erros ficam contidos aqui — financeiro nunca faz rollback de agenda.
 */
export async function garantirCobrancaDaSessao(
  agendamentoId: string
): Promise<ChargeOutcome> {
  let connection: PoolConnection | undefined;
  try {
    connection = await getMysqlPool().getConnection();
    await connection.beginTransaction();
    const [rows] = await connection.query<RowDataPacket[]>(
      `SELECT a.ref_core AS agendamento_ref, a.sessao_clinica_ref, a.inicio,
              a.valor_centavos, o.ref_core AS organizacao_ref,
              pa.ref_core AS paciente_ref, pr.ref_core AS profissional_ref,
              CASE WHEN pa.convenio_ref IS NULL THEN 0
                   ELSE COALESCE(pa.custeado_pela_empresa, conv.empresa_paga_sessoes, 1) END
                AS custeado_pela_empresa
         FROM clinica_agendamentos a
         JOIN clinica_organizacoes o ON o.id = a.organizacao_id
         JOIN clinica_pacientes pa ON pa.id = a.paciente_id
         JOIN clinica_profissionais pr ON pr.id = a.profissional_id
         LEFT JOIN clinica_convenios conv
           ON conv.instituicao_id = pa.instituicao_id
          AND conv.organizacao_ref = o.ref_core AND conv.ref_core = pa.convenio_ref
        WHERE a.instituicao_id = ? AND a.ref_core = ? AND a.status <> 'cancelado'
        LIMIT 1 FOR UPDATE`,
      [instituicaoId(), agendamentoId]
    );
    const appointment = rows[0];
    if (!appointment) {
      await connection.rollback();
      console.warn(`[financeiro] Agendamento ${agendamentoId} não encontrado para gerar cobrança.`);
      return 'skipped';
    }

    const decision = decideSessionCharge({
      amountCents: appointment.valor_centavos,
      companyFunded: Boolean(appointment.custeado_pela_empresa),
    });
    if (!decision.create) {
      await connection.commit();
      if (decision.reason === 'missing_amount') {
        console.warn(`[financeiro] Agendamento ${agendamentoId} sem valor; cobrança não criada.`);
      }
      return 'skipped';
    }

    const clinicalSessionRef = String(
      appointment.sessao_clinica_ref ?? appointment.agendamento_ref
    );
    const [existing] = await connection.query<RowDataPacket[]>(
      `SELECT ref_core FROM financeiro_cobrancas
        WHERE instituicao_id = ? AND organizacao_ref = ?
          AND sessao_ref IN (?, ?) AND status <> 'cancelled'
        LIMIT 1 FOR UPDATE`,
      [
        instituicaoId(),
        appointment.organizacao_ref,
        appointment.agendamento_ref,
        clinicalSessionRef,
      ]
    );
    if (existing[0]) {
      await connection.commit();
      return 'existing';
    }

    const sessionStart = fromSqlTimestamp(String(appointment.inicio));
    if (!sessionStart) throw new Error('Início da sessão inválido.');
    const chargeRef = `charge-session-${randomUUID()}`;
    await connection.execute(
      `INSERT INTO financeiro_cobrancas
         (id, instituicao_id, organizacao_ref, ref_core, sessao_ref, paciente_ref,
          profissional_ref, emitida_em, vence_em, valor_centavos, status,
          descricao, criado_em, atualizado_em)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'pending', ?,
               CURRENT_TIMESTAMP(3), CURRENT_TIMESTAMP(3))`,
      [
        rowId('cobranca', chargeRef),
        instituicaoId(),
        appointment.organizacao_ref,
        chargeRef,
        appointment.agendamento_ref,
        appointment.paciente_ref,
        appointment.profissional_ref,
        toSqlTimestamp(sessionStart),
        toSqlTimestamp(sessionStart),
        decision.amountCents,
        descricaoFiscalDaSessao(sessionStart),
      ]
    );
    await connection.commit();
    return 'created';
  } catch (error) {
    await connection?.rollback().catch(() => undefined);
    console.error(
      `[financeiro] Sessão ${agendamentoId} foi agendada, mas a cobrança não pôde ser criada:`,
      error instanceof Error ? error.message : error
    );
    return 'failed';
  } finally {
    connection?.release();
  }
}

/** Cancela somente cobranças sem pagamento confirmado. */
export async function cancelarCobrancaDaSessao(
  agendamentoId: string
): Promise<CancelOutcome> {
  let connection: PoolConnection | undefined;
  try {
    connection = await getMysqlPool().getConnection();
    await connection.beginTransaction();
    const [rows] = await connection.query<RowDataPacket[]>(
      `SELECT a.ref_core AS agendamento_ref, a.sessao_clinica_ref,
              o.ref_core AS organizacao_ref
         FROM clinica_agendamentos a
         JOIN clinica_organizacoes o ON o.id = a.organizacao_id
        WHERE a.instituicao_id = ? AND a.ref_core = ?
        LIMIT 1 FOR UPDATE`,
      [instituicaoId(), agendamentoId]
    );
    const appointment = rows[0];
    if (!appointment) {
      await connection.rollback();
      return 'not_found';
    }
    const clinicalSessionRef = String(
      appointment.sessao_clinica_ref ?? appointment.agendamento_ref
    );
    const [result] = await connection.execute<ResultSetHeader>(
      `UPDATE financeiro_cobrancas c
          SET c.status = 'cancelled', c.atualizado_em = CURRENT_TIMESTAMP(3)
        WHERE c.instituicao_id = ? AND c.organizacao_ref = ?
          AND c.sessao_ref IN (?, ?)
          AND c.status NOT IN ('cancelled', 'refunded')
          AND NOT EXISTS (
            SELECT 1 FROM financeiro_pagamentos p
             WHERE p.instituicao_id = c.instituicao_id
               AND p.organizacao_ref = c.organizacao_ref
               AND p.cobranca_ref = c.ref_core AND p.status = 'confirmed'
          )`,
      [
        instituicaoId(),
        appointment.organizacao_ref,
        appointment.agendamento_ref,
        clinicalSessionRef,
      ]
    );
    await connection.commit();
    return result.affectedRows > 0 ? 'cancelled' : 'kept';
  } catch (error) {
    await connection?.rollback().catch(() => undefined);
    console.error(
      `[financeiro] Sessão ${agendamentoId} foi cancelada, mas a cobrança não pôde ser atualizada:`,
      error instanceof Error ? error.message : error
    );
    return 'failed';
  } finally {
    connection?.release();
  }
}
