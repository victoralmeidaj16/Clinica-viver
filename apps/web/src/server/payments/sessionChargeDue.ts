import 'server-only';
import { randomUUID } from 'node:crypto';
import type { RowDataPacket } from 'mysql2';
import type { PoolConnection } from 'mysql2/promise';
import { getMysqlPool } from '@/server/oci/runtime';
import { instituicaoId, toSqlTimestamp } from '@/server/persistence/mysql/mappers';
import { isFutureChargeDueAt } from '@/lib/chargeDue';
import { readDueResetPlan } from './sessionChargeDuePlan';
import { hasPendingChargeDueReset } from './sessionChargeDueQueue';
import { processAppointmentChargeDue } from './sessionChargeDueWorker';

export type UpdateChargeDueOutcome = 'updated' | 'queued' | 'not_found' | 'paid' | 'invalid';

/** Só persiste a intenção. Nenhuma chamada ao provedor pode ocorrer sob a trava da agenda. */
export async function resetAppointmentChargeDue(
  connection: PoolConnection, appointmentId: string, dueAt: string
): Promise<UpdateChargeDueOutcome> {
  const plan = await readDueResetPlan(connection, appointmentId);
  if (!plan) return 'not_found';
  if (plan.paid) return 'paid';
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
  return 'queued';
}

export async function atualizarVencimentoCobrancaSessao(input: {
  organizationId: string; professionalId: string; appointmentId: string; dueAt: string;
}): Promise<UpdateChargeDueOutcome> {
  if (!isFutureChargeDueAt(input.dueAt)) return 'invalid';
  const connection = await getMysqlPool().getConnection();
  let appointmentId: string;
  let result: UpdateChargeDueOutcome;
  try {
    await connection.beginTransaction();
    const [rows] = await connection.query<RowDataPacket[]>(
      `SELECT a.id FROM clinica_agendamentos a
         JOIN clinica_organizacoes o ON o.id = a.organizacao_id
         JOIN clinica_profissionais p ON p.id = a.profissional_id
        WHERE a.instituicao_id = ? AND o.ref_core = ? AND p.ref_core = ?
          AND (a.id = ? OR a.ref_core = ?) LIMIT 1 FOR UPDATE`,
      [instituicaoId(), input.organizationId, input.professionalId, input.appointmentId, input.appointmentId]
    );
    if (!rows[0]) { await connection.rollback(); return 'not_found'; }
    appointmentId = String(rows[0].id);
    result = await resetAppointmentChargeDue(connection, appointmentId, input.dueAt);
    await connection.commit();
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally { connection.release(); }
  return result === 'queued' ? processAppointmentChargeDue(appointmentId) : result;
}
