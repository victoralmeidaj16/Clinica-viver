import { createHash } from 'node:crypto';
import { reconcileSessionReceivables, type FinancialRepository, type PaymentMethod } from '@thats-life/core';
import type { RowDataPacket } from 'mysql2';
import { getMysqlPool, isMysqlConfigured } from '@/server/oci/runtime';
import { MysqlFinancialRepository } from '@/server/persistence/mysql/financialRepository';
import { instituicaoId } from '@/server/persistence/mysql/mappers';
import { custeioDoAgendamentoSql } from '@/server/persistence/mysql/custeioSql';
import { expireUnstartedChargeCheckouts, hasReservedChargePayment } from '@/server/payments/chargeCheckoutGuard';
import { getApplicationStore, persistApplicationState } from './store';
import type { RequestContext } from './context';
import { ApplicationError } from './http';

interface ManualPaymentInput {
  amountCents: number;
  expectedOutstandingCents: number;
  receivedAt: string;
  method: PaymentMethod;
}

export function validateManualPayment(body: unknown): ManualPaymentInput {
  const value = body && typeof body === 'object' ? body as Record<string, unknown> : {};
  if (!Number.isSafeInteger(value.amountCents) || Number(value.amountCents) <= 0
    || !Number.isSafeInteger(value.expectedOutstandingCents) || Number(value.expectedOutstandingCents) <= 0) {
    throw new ApplicationError('INVALID_AMOUNT', 'Informe um valor positivo em centavos.', 400);
  }
  const date = typeof value.receivedAt === 'string' ? value.receivedAt : '';
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)
    || !Number.isFinite(Date.parse(`${date}T12:00:00-03:00`))
    || new Date(`${date}T12:00:00-03:00`).toISOString().slice(0, 10) !== date
    || date > new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Sao_Paulo' }).format(new Date())) {
    throw new ApplicationError('INVALID_DATE', 'Informe uma data de recebimento válida, até hoje.', 400);
  }
  if (!['pix', 'cash', 'card', 'bank_transfer', 'other'].includes(String(value.method))) {
    throw new ApplicationError('INVALID_METHOD', 'Forma de pagamento inválida.', 400);
  }
  return {
    amountCents: Number(value.amountCents), expectedOutstandingCents: Number(value.expectedOutstandingCents),
    receivedAt: new Date(`${date}T12:00:00-03:00`).toISOString(), method: value.method as PaymentMethod,
  };
}

async function applyManualPayment(
  repository: FinancialRepository, context: RequestContext, chargeId: string, input: ManualPaymentInput,
  beforeSave?: () => Promise<void>,
) {
  const { organizationId, userId } = context.actor;
  const ledger = await repository.getLedger({ organizationId });
  const charge = ledger.charges.find((item) => item.id === chargeId);
  if (!charge) throw new ApplicationError('NOT_FOUND', 'Cobrança não encontrada.', 404);
  const paymentId = `manual-${createHash('sha256').update(JSON.stringify([organizationId, chargeId, context.idempotencyKey])).digest('hex')}`;
  const previous = ledger.payments.find((item) => item.id === paymentId);
  if (previous) {
    if (previous.amountCents !== input.amountCents || previous.receivedAt !== input.receivedAt || previous.method !== input.method) {
      throw new ApplicationError('CONFLICT', 'Esta solicitação já foi usada para outro lançamento.', 409);
    }
    return { paymentId, duplicate: true };
  }
  if (!['pending', 'overdue', 'partially_paid'].includes(charge.status)) {
    throw new ApplicationError('INVALID_STATE', 'Esta cobrança não permite recebimento manual.', 409);
  }
  const receivable = reconcileSessionReceivables(ledger).find((item) => item.chargeId === chargeId)!;
  if (receivable.outstandingAmountCents !== input.expectedOutstandingCents) {
    throw new ApplicationError('CONFLICT', 'O saldo mudou. Atualize o financeiro antes de registrar o pagamento.', 409);
  }
  if (input.amountCents > receivable.outstandingAmountCents) {
    throw new ApplicationError('INVALID_AMOUNT', 'O valor recebido excede o saldo em aberto.', 400);
  }
  if (charge.providerReference) {
    throw new ApplicationError('INVALID_STATE', 'Esta cobrança possui pagamento externo. Conclua o cancelamento ou a conciliação antes de registrar o recebimento manual.', 409);
  }
  await beforeSave?.();
  const now = new Date().toISOString();
  await repository.savePayment({
    id: paymentId, chargeId, amountCents: input.amountCents, receivedAt: input.receivedAt,
    method: input.method, status: 'confirmed', provider: 'manual', providerTransactionId: paymentId,
    registeredBy: userId, registeredAt: now,
  });
  await repository.saveCharge({
    ...charge, status: input.amountCents === receivable.outstandingAmountCents ? 'paid' : 'partially_paid',
    paymentMethod: input.method, updatedAt: now,
  });
  return { paymentId, duplicate: false };
}

// Serializa lançamentos também no adaptador de demonstração.
let demoQueue: Promise<unknown> = Promise.resolve();

export async function registerManualPayment(context: RequestContext, chargeId: string, body: unknown) {
  if (!context.actor.roles.some((role) => role === 'admin' || role === 'owner')) {
    throw new ApplicationError('FORBIDDEN', 'Somente administradores podem registrar pagamentos manuais.', 403);
  }
  if (!context.idempotencyKey || context.idempotencyKey.length > 128) {
    throw new ApplicationError('IDEMPOTENCY_REQUIRED', 'Informe uma chave de idempotência válida.', 400);
  }
  const input = validateManualPayment(body);
  if (!isMysqlConfigured()) {
    const run = demoQueue.then(async () => {
      const result = await applyManualPayment(getApplicationStore().financial, context, chargeId, input);
      await persistApplicationState();
      return result;
    });
    demoQueue = run.catch(() => undefined);
    return run;
  }
  const connection = await getMysqlPool().getConnection();
  try {
    await connection.beginTransaction();
    // O mesmo bloqueio da cobrança é usado pelos webhooks dos provedores.
    const [charges] = await connection.query<RowDataPacket[]>(
      `SELECT ref_core FROM financeiro_cobrancas
        WHERE instituicao_id = ? AND organizacao_ref = ? AND ref_core = ? FOR UPDATE`,
      [instituicaoId(), context.actor.organizationId, chargeId],
    );
    if (!charges.length) throw new ApplicationError('NOT_FOUND', 'Cobrança não encontrada.', 404);
    const [coverage] = await connection.query<RowDataPacket[]>(
      `SELECT fc.fatura_convenio_ref,
              ${custeioDoAgendamentoSql({ agendamento: 'ag', paciente: 'p', convenio: 'conv' })} AS custeado
         FROM financeiro_cobrancas fc
         JOIN clinica_pacientes p ON p.instituicao_id = fc.instituicao_id AND p.ref_core = fc.paciente_ref
         LEFT JOIN clinica_agendamentos ag ON ag.instituicao_id = fc.instituicao_id
          AND fc.sessao_ref IN (ag.ref_core, ag.sessao_clinica_ref)
         LEFT JOIN clinica_convenios conv ON conv.instituicao_id = fc.instituicao_id
          AND conv.organizacao_ref = fc.organizacao_ref AND conv.ref_core = p.convenio_ref
        WHERE fc.instituicao_id = ? AND fc.organizacao_ref = ? AND fc.ref_core = ?`,
      [instituicaoId(), context.actor.organizationId, chargeId],
    );
    if (coverage.some((row) => row.custeado || row.fatura_convenio_ref)) {
      throw new ApplicationError('INVALID_STATE', 'Registre o recebimento pela fatura do convênio.', 409);
    }
    const result = await applyManualPayment(new MysqlFinancialRepository(connection), context, chargeId, input, async () => {
      if (await hasReservedChargePayment(connection, context.actor.organizationId, [chargeId])) {
        throw new ApplicationError('INVALID_STATE', 'Esta cobrança possui pagamento iniciado, agrupado ou em atualização. Conclua o cancelamento ou a conciliação antes de registrar o recebimento manual.', 409);
      }
      await expireUnstartedChargeCheckouts(connection, context.actor.organizationId, [chargeId]);
    });
    await connection.commit();
    return result;
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
}
