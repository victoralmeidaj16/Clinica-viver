import 'server-only';
import type { RowDataPacket } from 'mysql2';
import type { PoolConnection } from 'mysql2/promise';
import { allocatePaymentAcrossCharges } from '@/lib/paymentAllocation';
import { instituicaoId } from '@/server/persistence/mysql/mappers';

/** O chamador mantém as cobranças travadas; o rateio usa o saldo e preserva reentregas do mesmo pagamento. */
export async function allocateSettlement(connection: PoolConnection, charges: RowDataPacket[],
  amountCents: number, provider: 'inter' | 'asaas', transactionId: string) {
  if (!Number.isSafeInteger(amountCents) || amountCents < 0) throw new Error('Valor pago inválido.');
  const [payments] = await connection.query<RowDataPacket[]>(
    `SELECT ref_core, cobranca_ref, valor_centavos FROM financeiro_pagamentos
      WHERE instituicao_id = ? AND organizacao_ref = ? AND cobranca_ref IN (?) AND status = 'confirmed'
      FOR UPDATE`,
    [instituicaoId(), charges[0].organizacao_ref, charges.map((c) => String(c.ref_core))],
  );
  const ownRefs = new Set(charges.map((c) => `${provider}-${transactionId}-${c.ref_core}`));
  const otherPaid = new Map<string, number>();
  let previousAmount = 0;
  for (const payment of payments) {
    const value = Number(payment.valor_centavos);
    if (!Number.isSafeInteger(value) || value < 0) throw new Error('Valor de pagamento registrado inválido.');
    if (ownRefs.has(String(payment.ref_core))) previousAmount += value;
    else {
      const ref = String(payment.cobranca_ref);
      otherPaid.set(ref, (otherPaid.get(ref) ?? 0) + value);
    }
  }
  if (!Number.isSafeInteger(previousAmount)) throw new Error('Total de pagamentos inválido.');
  const balances = charges.map((c) => {
    const total = Number(c.valor_centavos);
    const paid = otherPaid.get(String(c.ref_core)) ?? 0;
    if (!Number.isSafeInteger(total) || total <= 0 || !Number.isSafeInteger(paid)) throw new Error('Saldo da cobrança inválido.');
    return { reference: String(c.ref_core), amountCents: Math.max(total - paid, 0) };
  });
  // O Asaas pode entregar CONFIRMED e RECEIVED fora de ordem, ambos com o total do mesmo pagamento.
  const allocations = allocatePaymentAcrossCharges(Math.max(amountCents, previousAmount), balances.filter((c) => c.amountCents > 0));
  const fullyPaid = charges.every((charge) => (otherPaid.get(String(charge.ref_core)) ?? 0)
    + (allocations.find((a) => a.reference === String(charge.ref_core))?.amountCents ?? 0) >= Number(charge.valor_centavos));
  return { allocations, fullyPaid };
}
