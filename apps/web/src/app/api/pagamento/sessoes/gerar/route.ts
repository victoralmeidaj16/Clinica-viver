import { NextResponse } from 'next/server';
import { createAsaasPayment, getOrCreateAsaasCustomer } from '@/server/adapters/asaasAdapter';
import { createInterPixCharge } from '@/server/adapters/interPixAdapter';
import { rateLimited, validCpf } from '@/server/http/publicRequest';
import {
  bindBatchProviderPayment,
  claimCheckoutProvider,
  reconcileSettledInterPixCharge,
  reserveAppointmentChargeBatch,
} from '@/server/payments/paymentLinkRepository';
import { asaasDueDate } from '@/lib/chargeDue';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(request: Request) {
  if (rateLimited(request, 'pagamento-sessoes-gerar', { limite: 6 })) {
    return NextResponse.json({ error: 'Muitas tentativas. Aguarde alguns minutos.' }, { status: 429 });
  }
  try {
    const body = await request.json() as Record<string, unknown>;
    const tokens = Array.isArray(body.tokens) ? [...new Set(body.tokens.map(String))] : [];
    const cpf = String(body.cpf ?? '').replace(/\D/g, '');
    const paymentMethod = String(body.paymentMethod ?? '');
    if (tokens.length < 2 || tokens.length > 10 || tokens.some((token) => !/^[a-f0-9]{32}$/.test(token))) {
      return NextResponse.json({ error: 'Selecione entre 2 e 10 sessões válidas.' }, { status: 400 });
    }
    if (!validCpf(cpf)) return NextResponse.json({ error: 'Informe um CPF válido.' }, { status: 400 });
    if (!['PIX', 'CREDIT_CARD'].includes(paymentMethod)) {
      return NextResponse.json({ error: 'Escolha Pix ou cartão de crédito.' }, { status: 400 });
    }

    const checkout = await reserveAppointmentChargeBatch({ tokens, cpf });
    const provider = paymentMethod === 'PIX' ? 'inter' : 'asaas';
    const claimed = await claimCheckoutProvider(checkout.externalReference, provider);
    if (claimed !== provider) return NextResponse.json({ error: 'Este pagamento já foi iniciado por outra forma.' }, { status: 409 });

    if (paymentMethod === 'PIX') {
      const pix = await createInterPixCharge({
        externalReference: checkout.externalReference,
        amountCents: checkout.amountCents,
        patientName: checkout.patientName,
        patientCpf: checkout.patientCpf,
        description: checkout.description!,
        dueAt: checkout.dueAt,
      });
      await bindBatchProviderPayment(checkout, pix.id, 'inter');
      await reconcileSettledInterPixCharge(pix);
      return NextResponse.json({ success: true, provider: 'inter', paymentMethod: 'PIX',
        pacienteNome: checkout.patientName, quantidade: tokens.length, descontoCentavos: checkout.discountCents, subtotalCentavos: checkout.subtotalCents, valor: pix.value,
        pixQrCode: pix.pixQrCode, pixCopiaECola: pix.pixCopiaECola });
    }

    const customerId = await getOrCreateAsaasCustomer({ name: checkout.patientName,
      cpfCnpj: checkout.patientCpf, mobilePhone: checkout.patientPhone, email: checkout.patientEmail });
    const payment = await createAsaasPayment({ customerId, value: checkout.amountCents / 100,
      dueDate: asaasDueDate(checkout.dueAt), description: checkout.description!,
      billingType: 'CREDIT_CARD', externalReference: checkout.externalReference });
    await bindBatchProviderPayment(checkout, payment.id, 'asaas');
    return NextResponse.json({ success: true, provider: 'asaas', paymentMethod: 'CREDIT_CARD',
      pacienteNome: checkout.patientName, quantidade: tokens.length, descontoCentavos: checkout.discountCents, subtotalCentavos: checkout.subtotalCents, valor: payment.value,
      invoiceUrl: payment.invoiceUrl });
  } catch (error) {
    console.error('[pagamento-sessoes] Falha ao gerar cobrança agrupada:', error);
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Não foi possível gerar o pagamento.' }, { status: 400 });
  }
}
