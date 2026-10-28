import 'server-only';
import type { ResultSetHeader } from 'mysql2';
import { getMysqlPool } from '@/server/oci/runtime';
import { instituicaoId } from '@/server/persistence/mysql/mappers';
import { asaasDueDate } from '@/lib/chargeDue';
import { createAsaasPayment, findAsaasPaymentByExternalReference, getAsaasPayment,
  getOrCreateAsaasCustomer } from '@/server/adapters/asaasAdapter';
import { SessionChargeUnavailableError, type ReservedCheckout } from './paymentLinkRepository';

/** A reserva não expira: um timeout pode acontecer depois de o Asaas aceitar a emissão. */
export async function getOrCreateCheckoutCardPayment(checkout: ReservedCheckout, bind: (id: string) => Promise<void>) {
  if (checkout.providerPaymentId) return getAsaasPayment(checkout.providerPaymentId);
  const pool = getMysqlPool();
  const [claim] = await pool.execute<ResultSetHeader>(
    `UPDATE financeiro_checkouts_asaas SET erro_codigo = 'CARD_ISSUING'
      WHERE instituicao_id = ? AND referencia_externa = ? AND provedor = 'asaas'
        AND provedor_pagamento_ref IS NULL AND (erro_codigo IS NULL OR erro_codigo NOT IN ('CARD_ISSUING', 'CARD_UNKNOWN'))
        AND status IN ('creating', 'pending')`,
    [instituicaoId(), checkout.externalReference],
  );
  const acquired = claim.affectedRows === 1;
  let paymentMayExist = false;
  try {
    let payment = await findAsaasPaymentByExternalReference(checkout.externalReference);
    paymentMayExist = Boolean(payment);
    if (!payment) {
      if (!acquired) throw new SessionChargeUnavailableError('O pagamento ainda está sendo confirmado. Aguarde e tente novamente.');
      const customerId = await getOrCreateAsaasCustomer({ name: checkout.patientName, cpfCnpj: checkout.patientCpf,
        mobilePhone: checkout.patientPhone, email: checkout.patientEmail });
      paymentMayExist = true;
      payment = await createAsaasPayment({ customerId, value: checkout.amountCents / 100,
        dueDate: asaasDueDate(checkout.dueAt),
        description: checkout.description ?? `Sessão de Psicoterapia - ${checkout.professionalName}`,
        billingType: 'CREDIT_CARD', externalReference: checkout.externalReference });
    }
    await bind(payment.id);
    return payment;
  } catch (error) {
    if (acquired) {
      await pool.execute(
        `UPDATE financeiro_checkouts_asaas SET erro_codigo = ?
          WHERE instituicao_id = ? AND referencia_externa = ? AND erro_codigo = 'CARD_ISSUING'
            AND provedor_pagamento_ref IS NULL`,
        [paymentMayExist ? 'CARD_UNKNOWN' : null, instituicaoId(), checkout.externalReference],
      );
    }
    throw error;
  }
}
