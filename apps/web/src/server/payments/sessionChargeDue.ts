import 'server-only';
import { randomUUID } from 'node:crypto';
import type { ResultSetHeader, RowDataPacket } from 'mysql2';
import type { PoolConnection } from 'mysql2/promise';
import { getMysqlPool } from '@/server/oci/runtime';
import { instituicaoId, toSqlTimestamp } from '@/server/persistence/mysql/mappers';
import { vencimentoDoAgendamentoGestao, type VencimentoAgendamento } from '@/server/scheduling/gestaoAgendaRepository';
import { isFutureChargeDueAt } from '@/lib/chargeDue';
import { readDueResetPlan, type DueResetPlan } from './sessionChargeDuePlan';
import { hasPendingChargeDueReset } from './sessionChargeDueQueue';
import { processAppointmentChargeDue } from './sessionChargeDueWorker';

export type UpdateChargeDueOutcome = 'updated' | 'queued' | 'not_found' | 'paid' | 'invalid';

/** Só persiste a intenção. Nenhuma chamada ao provedor pode ocorrer sob a trava da agenda. */
export async function resetAppointmentChargeDue(
  connection: PoolConnection, appointmentId: string, dueAt: string
): Promise<UpdateChargeDueOutcome> {
  const plan = await readDueResetPlan(connection, appointmentId);
  if (!plan) {
    const [result] = await connection.execute<ResultSetHeader>(
      'UPDATE clinica_agendamentos SET cobranca_vence_em = ? WHERE instituicao_id = ? AND id = ?',
      [toSqlTimestamp(dueAt), instituicaoId(), appointmentId]
    );
    return result.affectedRows ? 'updated' : 'not_found';
  }
  if (plan.paid) return 'paid';
  await enqueueChargeDuePlan(connection, appointmentId, dueAt, plan);
  await connection.execute(
    'UPDATE clinica_agendamentos SET cobranca_vence_em = ? WHERE instituicao_id = ? AND id = ?',
    [toSqlTimestamp(dueAt), instituicaoId(), appointmentId]
  );
  return 'queued';
}

export async function enqueueChargeDuePlan(
  connection: PoolConnection, appointmentId: string, dueAt: string, plan: DueResetPlan
): Promise<void> {
  const refs = plan.charges.map((c) => String(c.ref_core));
  const checkoutRefs = plan.checkouts.map((c) => String(c.referencia_externa));
  const [members] = checkoutRefs.length ? await connection.query<RowDataPacket[]>(
    `SELECT cobranca_ref FROM financeiro_checkout_cobrancas
      WHERE instituicao_id = ? AND referencia_externa IN (?) FOR UPDATE`,
    [instituicaoId(), checkoutRefs]
  ) : [[]];
  const affectedChargeIds = [...new Set([
    ...refs, ...plan.checkouts.map((c) => String(c.cobranca_ref)),
    ...members.map((m) => String(m.cobranca_ref)),
  ])];
  if (await hasPendingChargeDueReset(connection, affectedChargeIds)) {
    throw new Error('A cobrança ainda está sendo atualizada. Aguarde antes de remarcar novamente.');
  }
  await connection.execute(
    `INSERT INTO financeiro_ajustes_vencimento
      (id, instituicao_id, agendamento_id, vence_em, plano) VALUES (?, ?, ?, ?, ?)`,
    [randomUUID(), instituicaoId(), appointmentId, toSqlTimestamp(dueAt), JSON.stringify({ ...plan, affectedChargeIds })]
  );
}

export async function atualizarVencimentoCobrancaSessao(input: {
  organizationId: string; professionalId: string; appointmentId: string; dueAt: string;
  aposAlteracao?: (anterior: VencimentoAgendamento) => Promise<void>;
}): Promise<UpdateChargeDueOutcome> {
  if (!isFutureChargeDueAt(input.dueAt)) return 'invalid';
  const connection = await getMysqlPool().getConnection();
  let appointmentId: string;
  let anterior: VencimentoAgendamento | null = null;
  let result: UpdateChargeDueOutcome;
  try {
    await connection.beginTransaction();
    anterior = await vencimentoDoAgendamentoGestao(connection, input.organizationId, input.professionalId, input.appointmentId);
    if (!anterior) { await connection.rollback(); return 'not_found'; }
    appointmentId = anterior.agendamentoId;
    result = await resetAppointmentChargeDue(connection, appointmentId, input.dueAt);
    await connection.commit();
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally { connection.release(); }
  const outcome = result === 'queued' ? await processAppointmentChargeDue(appointmentId) : result;
  if (anterior && (outcome === 'updated' || outcome === 'queued')) await input.aposAlteracao?.(anterior);
  return outcome;
}
