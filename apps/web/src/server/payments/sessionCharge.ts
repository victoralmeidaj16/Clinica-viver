import 'server-only';

import { randomUUID } from 'node:crypto';
import type { RowDataPacket } from 'mysql2';
import type { PoolConnection } from 'mysql2/promise';
import { decideSessionCharge } from '@/lib/sessionChargeRules';
import { descricaoFiscalDaSessao } from '@/lib/sessionReference';
import { getMysqlPool } from '@/server/oci/runtime';
import { custeioDoAgendamentoSql } from '@/server/persistence/mysql/custeioSql';
import {
  fromSqlTimestamp,
  instituicaoId,
  rowId,
  toSqlTimestamp,
} from '@/server/persistence/mysql/mappers';
import { isFutureChargeDueAt } from '@/lib/chargeDue';

type ChargeOutcome = 'created' | 'existing' | 'skipped' | 'failed';

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
  // `agendamentoId` chega das duas formas: a referência do agregado, usada pelo
  // fluxo administrativo, e a chave física da linha, devolvida pelo agendamento
  // do link público e pela listagem da agenda. Procurar só por uma delas fazia a
  // cobrança nunca ser criada para metade dos chamadores.
  let connection: PoolConnection | undefined;
  try {
    connection = await getMysqlPool().getConnection();
    await connection.beginTransaction();
    const [rows] = await connection.query<RowDataPacket[]>(
      `SELECT a.ref_core AS agendamento_ref, a.sessao_clinica_ref, a.inicio, a.cobranca_vence_em,
              a.valor_centavos, o.ref_core AS organizacao_ref,
              pa.ref_core AS paciente_ref, pr.ref_core AS profissional_ref,
              ${custeioDoAgendamentoSql({ agendamento: 'a', paciente: 'pa', convenio: 'conv' })}
                AS custeado_pela_empresa
         FROM clinica_agendamentos a
         JOIN clinica_organizacoes o ON o.id = a.organizacao_id
         JOIN clinica_pacientes pa ON pa.id = a.paciente_id
         JOIN clinica_profissionais pr ON pr.id = a.profissional_id
         LEFT JOIN clinica_convenios conv
           ON conv.instituicao_id = pa.instituicao_id
          AND conv.organizacao_ref = o.ref_core AND conv.ref_core = pa.convenio_ref
        WHERE a.instituicao_id = ? AND (a.ref_core = ? OR a.id = ?)
          AND a.status <> 'cancelado'
        LIMIT 1 FOR UPDATE`,
      [instituicaoId(), agendamentoId, agendamentoId]
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
    const chargeDueAt = (appointment.cobranca_vence_em ? fromSqlTimestamp(appointment.cobranca_vence_em) : undefined) ?? dueAt ?? sessionStart;
    if (!Number.isFinite(Date.parse(chargeDueAt))) throw new Error('Vencimento da cobrança inválido.');
    const status = isFutureChargeDueAt(chargeDueAt) ? 'pending' : 'overdue';
    const chargeRef = `charge-session-${randomUUID()}`;
    await connection.execute(
      `INSERT INTO financeiro_cobrancas
         (id, instituicao_id, organizacao_ref, ref_core, sessao_ref, paciente_ref,
          profissional_ref, emitida_em, vence_em, valor_centavos, status,
          descricao, criado_em, atualizado_em)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, '${status}', ?,
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

export { atualizarVencimentoCobrancaSessao, type UpdateChargeDueOutcome } from './sessionChargeDue';

export { expirarCobrancasPendentes } from './sessionChargeExpiry';

export { cancelarCobrancaDaSessao } from './sessionChargeCancellation';
