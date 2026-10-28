import 'server-only';
import type { RowDataPacket } from 'mysql2';
import { getMysqlPool } from '@/server/oci/runtime';
import { fromSqlTimestamp, instituicaoId } from '@/server/persistence/mysql/mappers';
import { enqueueChargeDuePlan } from './sessionChargeDue';
import { readChargeResetPlan } from './sessionChargeDuePlan';
import { hasPendingChargeDueReset } from './sessionChargeDueQueue';
import { processAppointmentChargeDue } from './sessionChargeDueWorker';

async function reserveExpiry(chargeId: string): Promise<{ jobKey?: string; paid?: boolean }> {
  const connection = await getMysqlPool().getConnection();
  try {
    await connection.beginTransaction();
    // A mesma ordem de travas da remarcação: agenda, cobrança, checkout e fila.
    const [appointments] = await connection.query<RowDataPacket[]>(
      `SELECT a.id FROM clinica_agendamentos a
         JOIN clinica_organizacoes o ON o.id = a.organizacao_id
         JOIN financeiro_cobrancas c ON c.instituicao_id = a.instituicao_id AND c.organizacao_ref = o.ref_core
          AND c.sessao_ref IN (a.ref_core, COALESCE(a.sessao_clinica_ref, a.ref_core))
        WHERE a.instituicao_id = ? AND c.ref_core = ? LIMIT 1`,
      [instituicaoId(), chargeId]
    );
    if (appointments[0]) {
      await connection.query(
        'SELECT id FROM clinica_agendamentos WHERE instituicao_id = ? AND id = ? FOR UPDATE',
        [instituicaoId(), appointments[0].id]
      );
    }
    const [charges] = await connection.query<RowDataPacket[]>(
      `SELECT c.id, c.ref_core, c.organizacao_ref, c.status, c.provedor_ref, c.vence_em,
              EXISTS(SELECT 1 FROM financeiro_pagamentos p
                WHERE p.instituicao_id = c.instituicao_id AND p.organizacao_ref = c.organizacao_ref
                  AND p.cobranca_ref = c.ref_core AND p.status = 'confirmed') AS possui_pagamento
         FROM financeiro_cobrancas c
        WHERE c.instituicao_id = ? AND c.ref_core = ? AND c.status IN ('draft', 'pending')
          AND c.vence_em <= CURRENT_TIMESTAMP(3) FOR UPDATE`,
      [instituicaoId(), chargeId]
    );
    if (!charges.length || await hasPendingChargeDueReset(connection, [chargeId])) {
      await connection.rollback();
      return {};
    }
    const plan = await readChargeResetPlan(connection, charges);
    if (!plan || plan.paid) { await connection.rollback(); return { paid: plan?.paid }; }
    // Cobranças legadas sem agenda usam sua própria chave física para a retomada.
    const jobKey = String(appointments[0]?.id ?? charges[0].id);
    await enqueueChargeDuePlan(connection, jobKey, fromSqlTimestamp(charges[0].vence_em)!, { ...plan, operation: 'expire' });
    await connection.commit();
    return { jobKey };
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally { connection.release(); }
}

export async function expirarCobrancasPendentes(limit = 100): Promise<{ expired: number; paid: number; failed: number }> {
  const [rows] = await getMysqlPool().query<RowDataPacket[]>(
    `SELECT c.ref_core FROM financeiro_cobrancas c
      WHERE c.instituicao_id = ? AND c.status IN ('draft', 'pending')
        AND c.vence_em <= CURRENT_TIMESTAMP(3)
      ORDER BY c.vence_em LIMIT ?`,
    [instituicaoId(), Math.max(1, Math.min(limit, 500))]
  );
  const result = { expired: 0, paid: 0, failed: 0 };
  for (const row of rows) {
    try {
      const reservation = await reserveExpiry(String(row.ref_core));
      if (reservation.paid) { result.paid += 1; continue; }
      if (!reservation.jobKey) continue;
      const outcome = await processAppointmentChargeDue(reservation.jobKey);
      if (outcome === 'updated') result.expired += 1;
      else if (outcome === 'paid') result.paid += 1;
      else result.failed += 1;
    } catch {
      result.failed += 1;
      console.error('[financeiro] Não foi possível reservar a expiração de uma cobrança.');
    }
  }
  return result;
}
