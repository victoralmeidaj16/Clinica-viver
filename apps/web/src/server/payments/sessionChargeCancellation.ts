import 'server-only';
import { hasPendingChargeDueReset } from './sessionChargeDueQueue';

import { randomUUID } from 'node:crypto';
import type { ResultSetHeader, RowDataPacket } from 'mysql2';
import type { PoolConnection } from 'mysql2/promise';
import { getMysqlPool } from '@/server/oci/runtime';
import { instituicaoId } from '@/server/persistence/mysql/mappers';
import { isAsaasPaymentSettled } from '@/lib/chargeDue';
import { AsaasPaymentNotFoundError, deleteAsaasPayment, getAsaasPayment } from '@/server/adapters/asaasAdapter';
import { cancelInterPixCharge, getInterPixCharge } from '@/server/adapters/interPixAdapter';

export type CancelOutcome = 'cancelled' | 'kept' | 'not_found' | 'failed';

/** Distingue cancelamento já concluído de pagamento: necessário ao retomar um ajuste. */
export async function remoteCancellationState(provider: string, id: string): Promise<'pending' | 'paid' | 'cancelled'> {
  if (provider === 'inter') {
    const charge = await getInterPixCharge(id);
    if (charge.status === 'CONCLUIDA' || charge.settlements.length > 0) return 'paid';
    if (['REMOVIDA_PELO_USUARIO_RECEBEDOR', 'REMOVIDA_PELO_PSP'].includes(charge.status)) return 'cancelled';
    if (charge.status !== 'ATIVA') throw new Error('Situação da cobrança Inter não permite cancelamento.');
    return 'pending';
  }
  if (provider !== 'asaas') throw new Error('Provedor de cobrança desconhecido.');
  try { return isAsaasPaymentSettled((await getAsaasPayment(id)).status) ? 'paid' : 'pending'; }
  catch (error) { if (error instanceof AsaasPaymentNotFoundError) return 'cancelled'; throw error; }
}

/** Não trata falha de consulta como autorização para remover um pagamento. */
export async function cancelRemote(provider: string, id: string): Promise<boolean> {
  if (provider === 'inter') {
    const charge = await getInterPixCharge(id);
    if (charge.status === 'CONCLUIDA' || charge.settlements.length > 0) return false;
    if (!['REMOVIDA_PELO_USUARIO_RECEBEDOR', 'REMOVIDA_PELO_PSP'].includes(charge.status)) {
      if (charge.status !== 'ATIVA') throw new Error('Situação da cobrança Inter não permite cancelamento.');
      await cancelInterPixCharge(id);
    }
    return true;
  }
  if (provider !== 'asaas') throw new Error('Provedor de cobrança desconhecido.');
  try {
    const charge = await getAsaasPayment(id);
    if (isAsaasPaymentSettled(charge.status)) return false;
  } catch (error) {
    if (error instanceof AsaasPaymentNotFoundError) return true;
    throw error;
  }
  if (!await deleteAsaasPayment(id)) throw new Error('O Asaas não confirmou a remoção da cobrança.');
  return true;
}

/** Cancela no provedor antes de invalidar o checkout e a cobrança local. */
export async function cancelarCobrancaDaSessao(appointmentId: string): Promise<CancelOutcome> {
  let connection: PoolConnection | undefined;
  try {
    connection = await getMysqlPool().getConnection();
    await connection.beginTransaction();
    const [appointments] = await connection.query<RowDataPacket[]>(
      `SELECT a.ref_core AS agendamento_ref, a.sessao_clinica_ref, o.ref_core AS organizacao_ref
         FROM clinica_agendamentos a
         JOIN clinica_organizacoes o ON o.id = a.organizacao_id
        WHERE a.instituicao_id = ? AND (a.ref_core = ? OR a.id = ?) LIMIT 1 FOR UPDATE`,
      [instituicaoId(), appointmentId, appointmentId]
    );
    const appointment = appointments[0];
    if (!appointment) { await connection.rollback(); return 'not_found'; }
    const [charges] = await connection.query<RowDataPacket[]>(
      `SELECT c.ref_core, c.status, c.provedor_ref,
              EXISTS(SELECT 1 FROM financeiro_pagamentos p
                WHERE p.instituicao_id = c.instituicao_id AND p.organizacao_ref = c.organizacao_ref
                  AND p.cobranca_ref = c.ref_core AND p.status = 'confirmed') AS possui_pagamento
         FROM financeiro_cobrancas c
        WHERE c.instituicao_id = ? AND c.organizacao_ref = ? AND c.sessao_ref IN (?, ?)
        FOR UPDATE`,
      [instituicaoId(), appointment.organizacao_ref, appointment.agendamento_ref,
        appointment.sessao_clinica_ref ?? appointment.agendamento_ref]
    );
    if (!charges.length || charges.some((charge) => Boolean(charge.possui_pagamento)
        || ['paid', 'partially_paid', 'refunded'].includes(String(charge.status)))) {
      await connection.rollback(); return 'kept';
    }

    const refs = charges.map((charge) => String(charge.ref_core));
    if (await hasPendingChargeDueReset(connection, refs)) {
      throw new Error('A cobrança está sendo atualizada após a remarcação. Tente novamente em instantes.');
    }
    // Uma sessão pode ser membro (e não a titular) de um checkout agrupado.
    const [checkouts] = await connection.query<RowDataPacket[]>(
      `SELECT x.id, x.cobranca_ref, x.referencia_externa, x.provedor,
              x.provedor_pagamento_ref, x.status
         FROM financeiro_checkouts_asaas x
        WHERE x.instituicao_id = ? AND x.organizacao_ref = ?
          AND (x.cobranca_ref IN (?) OR x.referencia_externa IN (
            SELECT m.referencia_externa FROM financeiro_checkout_cobrancas m
             WHERE m.instituicao_id = ? AND m.cobranca_ref IN (?)
          )) FOR UPDATE`,
      [instituicaoId(), appointment.organizacao_ref, refs, instituicaoId(), refs]
    );
    if (checkouts.some((checkout) => ['paid', 'refunded'].includes(String(checkout.status)))) {
      await connection.rollback(); return 'kept';
    }
    const remotes = new Map<string, { provider: string; id: string }>();
    for (const checkout of checkouts) {
      if (checkout.provedor && !checkout.provedor_pagamento_ref) {
        throw new Error('Pagamento em emissão. Tente novamente quando o provedor concluir.');
      }
      if (checkout.provedor_pagamento_ref) {
        const provider = String(checkout.provedor ?? 'asaas');
        const id = String(checkout.provedor_pagamento_ref);
        remotes.set(`${provider}:${id}`, { provider, id });
      }
    }
    for (const charge of charges) {
      if (!charge.provedor_ref) continue;
      const checkout = checkouts.find((item) => item.provedor_pagamento_ref === charge.provedor_ref);
      const provider = String(checkout?.provedor ?? 'asaas');
      const id = String(charge.provedor_ref);
      remotes.set(`${provider}:${id}`, { provider, id });
    }
    for (const { provider, id } of remotes.values()) {
      if (!await cancelRemote(provider, id)) { await connection.rollback(); return 'kept'; }
    }

    for (const checkout of checkouts) {
      // As outras sessões do grupo continuam cobradas, mas exigem um novo checkout.
      await connection.execute(
        `DELETE FROM financeiro_checkout_cobrancas WHERE instituicao_id = ? AND referencia_externa = ?`,
        [instituicaoId(), checkout.referencia_externa]
      );
      await connection.execute(
        `UPDATE financeiro_checkouts_asaas SET referencia_externa = ?, provedor_pagamento_ref = NULL,
            provedor = NULL, status = ?, erro_codigo = 'SESSION_CANCELLED',
            expirado_em = CURRENT_TIMESTAMP(3), atualizado_em = CURRENT_TIMESTAMP(3)
          WHERE instituicao_id = ? AND id = ?`,
        [`VM-${randomUUID()}`, refs.includes(String(checkout.cobranca_ref)) ? 'expired' : 'creating',
          instituicaoId(), checkout.id]
      );
    }
    const [cancelled] = await connection.execute<ResultSetHeader>(
      `UPDATE financeiro_cobrancas SET status = 'cancelled', provedor_ref = NULL,
          atualizado_em = CURRENT_TIMESTAMP(3)
        WHERE instituicao_id = ? AND organizacao_ref = ? AND ref_core IN (${refs.map(() => '?').join(', ')})`,
      [instituicaoId(), appointment.organizacao_ref, ...refs]
    );
    const pendingCount = charges.filter((charge) => charge.status !== 'cancelled').length;
    if (cancelled.affectedRows < pendingCount) {
      throw new Error('O banco não confirmou o cancelamento de todas as cobranças.');
    }
    await connection.commit();
    return 'cancelled';
  } catch (error) {
    await connection?.rollback().catch(() => undefined);
    console.error(`[financeiro] Falha ao cancelar a cobrança da sessão ${appointmentId}:`,
      error instanceof Error ? error.message : error);
    return 'failed';
  } finally { connection?.release(); }
}
