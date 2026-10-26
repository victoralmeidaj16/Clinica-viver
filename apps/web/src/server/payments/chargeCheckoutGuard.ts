import 'server-only';
import type { RowDataPacket } from 'mysql2';
import type { PoolConnection } from 'mysql2/promise';
import { instituicaoId } from '@/server/persistence/mysql/mappers';
import { hasPendingChargeDueReset } from './sessionChargeDueQueue';

/** O chamador deve manter as cobranças travadas até concluir a alteração. */
export async function hasReservedChargePayment(
  connection: PoolConnection, organizationId: string, chargeIds: string[],
): Promise<boolean> {
  if (!chargeIds.length) return false;
  if (await hasPendingChargeDueReset(connection, chargeIds)) return true;
  // Mesmo um grupo ainda sem provedor pode estar prestes a emitir o pagamento.
  const [members] = await connection.query<RowDataPacket[]>(
    `SELECT m.referencia_externa FROM financeiro_checkout_cobrancas m
       JOIN financeiro_cobrancas c ON c.instituicao_id = m.instituicao_id AND c.ref_core = m.cobranca_ref
      WHERE c.instituicao_id = ? AND c.organizacao_ref = ? AND c.ref_core IN (?) FOR UPDATE`,
    [instituicaoId(), organizationId, chargeIds],
  );
  if (members.length) return true;
  // A trava também serializa com claimCheckoutProvider, inclusive antes da emissão remota.
  const [checkouts] = await connection.query<RowDataPacket[]>(
    `SELECT provedor, provedor_pagamento_ref, status FROM financeiro_checkouts_asaas
      WHERE instituicao_id = ? AND organizacao_ref = ? AND cobranca_ref IN (?) FOR UPDATE`,
    [instituicaoId(), organizationId, chargeIds],
  );
  return checkouts.some((checkout) => Boolean(checkout.provedor || checkout.provedor_pagamento_ref)
    || ['paid', 'refunded'].includes(String(checkout.status)));
}

/** Invalida reservas antigas antes de liberar a trava das cobranças alteradas. */
export async function expireUnstartedChargeCheckouts(
  connection: PoolConnection, organizationId: string, chargeIds: string[],
): Promise<void> {
  if (!chargeIds.length) return;
  await connection.execute(
    `UPDATE financeiro_checkouts_asaas SET status = 'expired', erro_codigo = 'CHARGE_CHANGED',
        expirado_em = CURRENT_TIMESTAMP(3), atualizado_em = CURRENT_TIMESTAMP(3)
      WHERE instituicao_id = ? AND organizacao_ref = ? AND cobranca_ref IN (${chargeIds.map(() => '?').join(', ')})
        AND provedor IS NULL AND provedor_pagamento_ref IS NULL AND status IN ('creating', 'pending')`,
    [instituicaoId(), organizationId, ...chargeIds],
  );
}
