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
import { deleteAsaasPayment, getAsaasPayment } from '@/server/adapters/asaasAdapter';
import { isAsaasPaymentSettled, isFutureChargeDueAt } from '@/lib/chargeDue';

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
  agendamentoId: string,
  dueAt?: string
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
    const issuedAt = new Date().toISOString();
    const chargeDueAt = dueAt ?? sessionStart;
    if (!isFutureChargeDueAt(chargeDueAt)) {
      throw new Error('O vencimento da cobrança deve estar no futuro.');
    }
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
        toSqlTimestamp(issuedAt),
        toSqlTimestamp(chargeDueAt),
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

export type UpdateChargeDueOutcome = 'updated' | 'not_found' | 'paid' | 'invalid';

/** Troca o vencimento e invalida qualquer QR/link remoto emitido com a regra anterior. */
export async function atualizarVencimentoCobrancaSessao(input: {
  organizationId: string; professionalId: string; appointmentId: string; dueAt: string;
}): Promise<UpdateChargeDueOutcome> {
  if (!isFutureChargeDueAt(input.dueAt)) return 'invalid';
  const [rows] = await getMysqlPool().query<RowDataPacket[]>(
    `SELECT c.ref_core AS cobranca_ref, c.status, c.provedor_ref,
            x.id AS checkout_id, x.provedor_pagamento_ref
       FROM clinica_agendamentos a
       JOIN clinica_organizacoes o ON o.id = a.organizacao_id
       JOIN clinica_profissionais p ON p.id = a.profissional_id
       JOIN financeiro_cobrancas c
         ON c.instituicao_id = a.instituicao_id AND c.organizacao_ref = o.ref_core
        AND c.sessao_ref IN (a.ref_core, COALESCE(a.sessao_clinica_ref, a.ref_core))
       LEFT JOIN financeiro_checkouts_asaas x
         ON x.instituicao_id = c.instituicao_id AND x.cobranca_ref = c.ref_core
      WHERE a.instituicao_id = ? AND o.ref_core = ? AND p.ref_core = ?
        AND (a.id = ? OR a.ref_core = ?) AND c.status <> 'cancelled'
      ORDER BY c.criado_em DESC LIMIT 1`,
    [instituicaoId(), input.organizationId, input.professionalId,
      input.appointmentId, input.appointmentId]
  );
  const row = rows[0];
  if (!row) return 'not_found';
  if (['paid', 'partially_paid', 'refunded'].includes(String(row.status))) return 'paid';
  const providerId = row.provedor_pagamento_ref ?? row.provedor_ref;
  if (providerId) {
    try {
      const remote = await getAsaasPayment(String(providerId));
      if (isAsaasPaymentSettled(remote.status)) return 'paid';
      await deleteAsaasPayment(String(providerId));
    } catch {
      // Uma remoção anterior pode ter sido concluída antes de a transação local
      // falhar. DELETE trata 404 como estado final e torna a retomada segura.
      await deleteAsaasPayment(String(providerId));
    }
  }

  const connection = await getMysqlPool().getConnection();
  try {
    await connection.beginTransaction();
    const [paymentRows] = await connection.query<RowDataPacket[]>(
      `SELECT id FROM financeiro_pagamentos WHERE instituicao_id = ? AND cobranca_ref = ?
        AND status = 'confirmed' LIMIT 1 FOR UPDATE`,
      [instituicaoId(), row.cobranca_ref]
    );
    if (paymentRows[0]) { await connection.rollback(); return 'paid'; }
    await connection.execute(
      `UPDATE financeiro_cobrancas SET vence_em = ?, status = 'pending', provedor_ref = NULL,
          forma_pagamento = NULL, atualizado_em = CURRENT_TIMESTAMP(3)
        WHERE instituicao_id = ? AND ref_core = ?`,
      [toSqlTimestamp(input.dueAt), instituicaoId(), row.cobranca_ref]
    );
    if (row.checkout_id) {
      const externalReference = `VM-${String(row.checkout_id).replaceAll('-', '')}-${Date.now()}`;
      await connection.execute(
        `UPDATE financeiro_checkouts_asaas
            SET referencia_externa = ?, provedor_pagamento_ref = NULL, status = 'creating',
                erro_codigo = NULL, expirado_em = NULL, atualizado_em = CURRENT_TIMESTAMP(3)
          WHERE instituicao_id = ? AND id = ?`,
        [externalReference, instituicaoId(), row.checkout_id]
      );
    }
    await connection.commit();
    return 'updated';
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally { connection.release(); }
}

export async function expirarCobrancasPendentes(limit = 100): Promise<{
  expired: number; paid: number; failed: number;
}> {
  const [rows] = await getMysqlPool().query<RowDataPacket[]>(
    `SELECT c.ref_core AS cobranca_ref, COALESCE(x.provedor_pagamento_ref, c.provedor_ref) AS provedor_ref
       FROM financeiro_cobrancas c
       LEFT JOIN financeiro_checkouts_asaas x
         ON x.instituicao_id = c.instituicao_id AND x.cobranca_ref = c.ref_core
      WHERE c.instituicao_id = ? AND c.status IN ('draft','pending')
        AND c.vence_em <= CURRENT_TIMESTAMP(3)
      ORDER BY c.vence_em LIMIT ?`,
    [instituicaoId(), Math.max(1, Math.min(limit, 500))]
  );
  const result = { expired: 0, paid: 0, failed: 0 };
  for (const row of rows) {
    try {
      if (row.provedor_ref) {
        try {
          const remote = await getAsaasPayment(String(row.provedor_ref));
          if (isAsaasPaymentSettled(remote.status)) { result.paid += 1; continue; }
          await deleteAsaasPayment(String(row.provedor_ref));
        } catch {
          await deleteAsaasPayment(String(row.provedor_ref));
        }
      }
      const [update] = await getMysqlPool().execute<ResultSetHeader>(
        `UPDATE financeiro_cobrancas c
            SET c.status = 'overdue', c.atualizado_em = CURRENT_TIMESTAMP(3)
          WHERE c.instituicao_id = ? AND c.ref_core = ?
            AND c.status IN ('draft','pending','overdue')
            AND NOT EXISTS (SELECT 1 FROM financeiro_pagamentos p
              WHERE p.instituicao_id = c.instituicao_id AND p.cobranca_ref = c.ref_core
                AND p.status = 'confirmed')`,
        [instituicaoId(), row.cobranca_ref]
      );
      await getMysqlPool().execute(
        `UPDATE financeiro_checkouts_asaas SET status = 'expired', erro_codigo = 'DEADLINE_EXPIRED',
            expirado_em = CURRENT_TIMESTAMP(3), atualizado_em = CURRENT_TIMESTAMP(3)
          WHERE instituicao_id = ? AND cobranca_ref = ? AND status <> 'paid'`,
        [instituicaoId(), row.cobranca_ref]
      );
      result.expired += update.affectedRows > 0 ? 1 : 0;
    } catch (error) {
      result.failed += 1;
      console.error(`[financeiro] Falha ao expirar cobrança ${String(row.cobranca_ref)}:`, error);
    }
  }
  return result;
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
