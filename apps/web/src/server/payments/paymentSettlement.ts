import 'server-only';
import type { RowDataPacket } from 'mysql2';
import type { PoolConnection } from 'mysql2/promise';
import { allocatePaymentAcrossCharges, type ChargeAllocation } from '@/lib/paymentAllocation';
import { instituicaoId } from '@/server/persistence/mysql/mappers';

export interface SettlementAllocation extends ChargeAllocation {
  parcelIndex: number;
}

function nextParcelIndex(existingRefs: ReadonlySet<string>, baseRef: string): number {
  if (!existingRefs.has(baseRef)) return 1;
  let index = 2;
  while (existingRefs.has(`${baseRef}:${index}`)) index += 1;
  return index;
}

/**
 * O chamador mantém as cobranças travadas; o rateio usa o saldo em aberto e
 * registra apenas o incremento líquido para preservar parcelas anteriores.
 */
export async function allocateSettlement(connection: PoolConnection, charges: RowDataPacket[],
  amountCents: number, provider: 'inter' | 'asaas', transactionId: string) {
  if (!Number.isSafeInteger(amountCents) || amountCents < 0) throw new Error('Valor pago inválido.');
  const [payments] = await connection.query<RowDataPacket[]>(
    `SELECT ref_core, cobranca_ref, valor_centavos, status FROM financeiro_pagamentos
      WHERE instituicao_id = ? AND organizacao_ref = ? AND cobranca_ref IN (?)
      FOR UPDATE`,
    [instituicaoId(), charges[0].organizacao_ref, charges.map((c) => String(c.ref_core))],
  );
  const existingRefs = new Set<string>();
  const paidByCharge = new Map<string, number>();
  let previousOwnAmount = 0;
  for (const payment of payments) {
    const refCore = String(payment.ref_core);
    const chargeRef = String(payment.cobranca_ref);
    existingRefs.add(refCore);
    if (payment.status === 'cancelled') continue;
    const value = Number(payment.valor_centavos);
    if (!Number.isSafeInteger(value) || value < 0) throw new Error('Valor de pagamento registrado inválido.');
    paidByCharge.set(chargeRef, (paidByCharge.get(chargeRef) ?? 0) + value);
    const ownBase = `${provider}-${transactionId}-${chargeRef}`;
    if (refCore === ownBase || refCore.startsWith(`${ownBase}:`)) previousOwnAmount += value;
  }
  if (!Number.isSafeInteger(previousOwnAmount)) throw new Error('Total de pagamentos inválido.');
  const deltaCents = Math.max(amountCents - previousOwnAmount, 0);
  const balances = charges.map((c) => {
    const total = Number(c.valor_centavos);
    const paid = paidByCharge.get(String(c.ref_core)) ?? 0;
    if (!Number.isSafeInteger(total) || total <= 0 || !Number.isSafeInteger(paid)) throw new Error('Saldo da cobrança inválido.');
    return { reference: String(c.ref_core), amountCents: Math.max(total - paid, 0) };
  });
  // O Asaas entrega o acumulado da cobrança em eventos sucessivos; alocar só o
  // incremento mantém cada parcela na competência em que foi recebida.
  const rawAllocations = deltaCents > 0
    ? allocatePaymentAcrossCharges(deltaCents, balances.filter((c) => c.amountCents > 0))
    : [];
  const allocations: SettlementAllocation[] = rawAllocations.map((allocation) => ({
    ...allocation,
    parcelIndex: nextParcelIndex(existingRefs, `${provider}-${transactionId}-${allocation.reference}`),
  }));
  const fullyPaid = charges.every((charge) => (paidByCharge.get(String(charge.ref_core)) ?? 0)
    + (allocations.find((a) => a.reference === String(charge.ref_core))?.amountCents ?? 0) >= Number(charge.valor_centavos));
  return { allocations, fullyPaid };
}
