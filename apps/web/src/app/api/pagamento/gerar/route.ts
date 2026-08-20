import { NextResponse } from 'next/server';
import {
  createAsaasPayment,
  findAsaasPaymentByExternalReference,
  getAsaasPayment,
  getOrCreateAsaasCustomer,
} from '@/server/adapters/asaasAdapter';
import { rateLimited, validCpf } from '@/server/http/publicRequest';
import {
  bindProviderPayment,
  reservePendingCharge,
  type PaymentModality,
} from '@/server/payments/paymentLinkRepository';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

function method(type: string): 'pix' | 'card' | 'other' {
  if (type === 'PIX') return 'pix';
  if (type === 'CREDIT_CARD') return 'card';
  return 'other';
}

export async function POST(request: Request) {
  if (rateLimited(request, 'pagamento-gerar')) {
    return NextResponse.json(
      { error: 'Muitas tentativas. Aguarde alguns minutos antes de tentar novamente.' },
      { status: 429, headers: { 'Retry-After': '600' } }
    );
  }
  try {
    const body = await request.json() as Record<string, unknown>;
    const token = String(body.psicologoId ?? '').trim();
    const modality = String(body.modalidade ?? '') as PaymentModality;
    const cpf = String(body.pacienteCpf ?? '').replace(/\D/g, '');
    if (!/^[a-f0-9]{32}$/.test(token) || !['social', 'particular'].includes(modality)) {
      return NextResponse.json({ error: 'Link de pagamento inválido.' }, { status: 404 });
    }
    if (!validCpf(cpf)) {
      return NextResponse.json({ error: 'Informe um CPF válido.' }, { status: 400 });
    }

    const checkout = await reservePendingCharge({ token, modality, cpf });
    if (!checkout) {
      return NextResponse.json({
        error: 'Não encontramos um atendimento concluído e pendente de pagamento para este CPF e psicólogo. Confira os dados ou fale com a clínica.',
      }, { status: 404 });
    }

    let payment = checkout.providerPaymentId
      ? await getAsaasPayment(checkout.providerPaymentId)
      : await findAsaasPaymentByExternalReference(checkout.externalReference);

    if (!payment) {
      const customerId = await getOrCreateAsaasCustomer({
        name: checkout.patientName,
        cpfCnpj: checkout.patientCpf,
        mobilePhone: checkout.patientPhone,
        email: checkout.patientEmail,
      });
      const dueDate = new Intl.DateTimeFormat('en-CA', {
        timeZone: 'America/Sao_Paulo',
      }).format(new Date());
      payment = await createAsaasPayment({
        customerId,
        value: checkout.amountCents / 100,
        dueDate,
        description: `Sessão de Psicoterapia - ${checkout.professionalName}`,
        billingType: (checkout.amountCents / 100) < 10 ? 'PIX' : 'UNDEFINED',
        externalReference: checkout.externalReference,
      });
    }

    await bindProviderPayment(checkout, payment.id, method(payment.billingType));
    return NextResponse.json({
      success: true,
      cobrancaId: payment.id,
      valor: payment.value,
      modalidade: modality,
      invoiceUrl: payment.invoiceUrl,
      status: payment.status,
      pixQrCode: payment.pixQrCode?.encodedImage,
      pixCopiaECola: payment.pixQrCode?.payload,
    }, { headers: { 'Cache-Control': 'private, no-store' } });
  } catch (error) {
    console.error('[pagamento] Falha ao gerar cobrança:', error instanceof Error ? error.message : error);
    return NextResponse.json({ error: 'Não foi possível gerar a cobrança agora. Tente novamente.' }, { status: 500 });
  }
}
