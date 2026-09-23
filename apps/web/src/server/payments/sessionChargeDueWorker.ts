import 'server-only';
import { randomUUID } from 'node:crypto';
import type { RowDataPacket } from 'mysql2';
import type { PoolConnection } from 'mysql2/promise';
import { getMysqlPool } from '@/server/oci/runtime';
import { instituicaoId } from '@/server/persistence/mysql/mappers';
import { remoteCancellationState, cancelRemote } from './sessionChargeCancellation';
import type { DueResetPlan } from './sessionChargeDuePlan';

type Plan = DueResetPlan & { affectedChargeIds: string[] };
type Outcome = 'updated' | 'queued' | 'paid' | 'not_found';

async function resetCheckout(connection: PoolConnection, checkout: RowDataPacket) {
  await connection.execute(
    'DELETE FROM financeiro_checkout_cobrancas WHERE instituicao_id = ? AND referencia_externa = ?',
    [instituicaoId(), checkout.referencia_externa]
  );
  await connection.execute(
    `UPDATE financeiro_checkouts_asaas SET referencia_externa = ?, provedor_pagamento_ref = NULL,
        provedor = NULL, status = 'creating', erro_codigo = NULL, expirado_em = NULL,
        atualizado_em = CURRENT_TIMESTAMP(3)
      WHERE instituicao_id = ? AND id = ? AND referencia_externa = ?`,
    [`VM-${randomUUID()}`, instituicaoId(), checkout.id, checkout.referencia_externa]
  );
}

async function setOutcome(connection: PoolConnection, id: string, status: 'paid' | 'completed') {
  await connection.execute(
    'UPDATE financeiro_ajustes_vencimento SET situacao = ? WHERE instituicao_id = ? AND id = ?',
    [status, instituicaoId(), id]
  );
}

async function checkpointCancellation(connection: PoolConnection, job: RowDataPacket, plan: Plan,
  remote: { provider: string; id: string }): Promise<Plan> {
  // Cada cancelamento tem seu próprio commit. Uma falha posterior nunca
  // reverte a limpeza de um pagamento já removido no provedor.
  await connection.beginTransaction();
  try {
    const removed = plan.checkouts.filter((x) => x.provedor_pagamento_ref === remote.id
      && String(x.provedor ?? 'asaas') === remote.provider);
    for (const checkout of removed) await resetCheckout(connection, checkout);
    await connection.execute(
      `UPDATE financeiro_cobrancas SET provedor_ref = NULL, forma_pagamento = NULL
        WHERE instituicao_id = ? AND organizacao_ref = ? AND provedor_ref = ?`,
      [instituicaoId(), plan.charges[0].organizacao_ref, remote.id]
    );
    const next = { ...plan,
      checkouts: plan.checkouts.filter((x) => !removed.includes(x)),
      remotes: plan.remotes.filter((r) => r.id !== remote.id || r.provider !== remote.provider),
    };
    await connection.execute(
      'UPDATE financeiro_ajustes_vencimento SET plano = ? WHERE instituicao_id = ? AND id = ?',
      [JSON.stringify(next), instituicaoId(), job.id]
    );
    await connection.commit();
    return next;
  } catch (error) { await connection.rollback(); throw error; }
}

async function processJob(connection: PoolConnection, job: RowDataPacket): Promise<Outcome> {
  let plan: Plan = typeof job.plano === 'string' ? JSON.parse(job.plano) : job.plano;
  let paid = false;
  // Consulta o lote inteiro antes de cancelar. Uma remoção já concluída em
  // uma tentativa anterior precisa ser conciliada mesmo se outro item foi pago.
  for (const remote of [...plan.remotes]) {
    const status = await remoteCancellationState(remote.provider, remote.id);
    if (status === 'cancelled') plan = await checkpointCancellation(connection, job, plan, remote);
    if (status === 'paid') paid = true;
  }
  if (paid) { await setOutcome(connection, String(job.id), 'paid'); return 'paid'; }
  for (const remote of [...plan.remotes]) {
    if (!await cancelRemote(remote.provider, remote.id)) {
      await setOutcome(connection, String(job.id), 'paid');
      return 'paid';
    }
    plan = await checkpointCancellation(connection, job, plan, remote);
  }
  await connection.beginTransaction();
  try {
    for (const checkout of plan.checkouts) await resetCheckout(connection, checkout);
    const refs = plan.charges.map((c) => String(c.ref_core));
    await connection.execute(
      `UPDATE financeiro_cobrancas c SET vence_em = ?, status = 'pending', provedor_ref = NULL,
          forma_pagamento = NULL, atualizado_em = CURRENT_TIMESTAMP(3)
        WHERE c.instituicao_id = ? AND c.organizacao_ref = ? AND c.ref_core IN (${refs.map(() => '?').join(', ')})
          AND c.status IN ('draft', 'pending', 'overdue')
          AND NOT EXISTS (SELECT 1 FROM financeiro_pagamentos p WHERE p.instituicao_id = c.instituicao_id
            AND p.organizacao_ref = c.organizacao_ref AND p.cobranca_ref = c.ref_core AND p.status = 'confirmed')`,
      [job.vence_em, instituicaoId(), plan.charges[0].organizacao_ref, ...refs]
    );
    await setOutcome(connection, String(job.id), 'completed');
    await connection.commit();
    return 'updated';
  } catch (error) { await connection.rollback(); throw error; }
}

/** Trava apenas o trabalhador financeiro; não mantém transação ou agenda travada durante a rede. */
export async function processAppointmentChargeDue(appointmentId: string): Promise<Outcome> {
  let connection: PoolConnection | undefined;
  const lock = `charge-due:${instituicaoId()}`;
  let acquired = false;
  try {
    connection = await getMysqlPool().getConnection();
    const [locks] = await connection.query<RowDataPacket[]>('SELECT GET_LOCK(?, 0) AS acquired', [lock]);
    acquired = Number(locks[0]?.acquired) === 1;
    if (!acquired) return 'queued';
    const [jobs] = await connection.query<RowDataPacket[]>(
      `SELECT id, plano, vence_em FROM financeiro_ajustes_vencimento
        WHERE instituicao_id = ? AND agendamento_id = ? AND situacao = 'pending' ORDER BY criado_em`,
      [instituicaoId(), appointmentId]
    );
    let result: Outcome = 'not_found';
    for (const job of jobs) result = await processJob(connection, job);
    return result;
  } catch (error) {
    console.error('[financeiro] Ajuste de vencimento pendente; será retomado:', error);
    return 'queued';
  } finally {
    if (acquired) await connection?.query('SELECT RELEASE_LOCK(?)', [lock]).catch(() => undefined);
    connection?.release();
  }
}

export async function processPendingChargeDueResets(limit = 100) {
  const [jobs] = await getMysqlPool().query<RowDataPacket[]>(
    `SELECT DISTINCT agendamento_id FROM financeiro_ajustes_vencimento
      WHERE instituicao_id = ? AND situacao = 'pending' LIMIT ?`,
    [instituicaoId(), Math.max(1, Math.min(100, limit))]
  );
  const results: Outcome[] = [];
  for (const job of jobs) results.push(await processAppointmentChargeDue(String(job.agendamento_id)));
  return { updated: results.filter((s) => s === 'updated').length,
    pending: results.filter((s) => s === 'queued').length, paid: results.filter((s) => s === 'paid').length };
}
