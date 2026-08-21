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
  reserveAppointmentCharge,
} from '@/server/payments/paymentLinkRepository';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

function method(type: string): 'pix' | 'card' | 'other' {
  if (type === 'PIX') return 'pix';
  if (type === 'CREDIT_CARD') return 'card';
  return 'other';
}

export async function POST(request: Request) {
  if (rateLimited(request, 'pagamento-sessao-gerar')) {
    return NextResponse.json(
      { error: 'Muitas tentativas. Aguarde alguns minutos antes de tentar novamente.' },
      { status: 429, headers: { 'Retry-After': '600' } }
    );
  }
  try {
    const body = await request.json() as Record<string, unknown>;
    const token = String(body.token ?? '').trim();
    const cpf = String(body.cpf ?? '').replace(/\D/g, '');
    if (!/^[a-f0-9]{32}$/.test(token)) {
      return NextResponse.json({ error: 'Link de pagamento inválido.' }, { status: 404 });
    }
    if (!validCpf(cpf)) {
      return NextResponse.json({ error: 'Informe um CPF válido.' }, { status: 400 });
    }

    const checkout = await reserveAppointmentCharge({ token, cpf });
    if (!checkout) {
      return NextResponse.json(
        { error: 'O CPF não corresponde ao paciente desta sessão. Confira os dados.' },
        { status: 404 }
      );
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
        description: checkout.description ?? `Sessão de Psicoterapia - ${checkout.professionalName}`,
        billingType: checkout.amountCents / 100 < 10 ? 'PIX' : 'UNDEFINED',
        externalReference: checkout.externalReference,
      });
    }

    await bindProviderPayment(checkout, payment.id, method(payment.billingType));
    return NextResponse.json({
      success: true,
      cobrancaId: payment.id,
      pacienteNome: checkout.patientName,
      sessaoInicio: checkout.sessionStart,
      valor: payment.value,
      invoiceUrl: payment.invoiceUrl,
      status: payment.status,
      pixQrCode: payment.pixQrCode?.encodedImage,
      pixCopiaECola: payment.pixQrCode?.payload,
    }, { headers: { 'Cache-Control': 'private, no-store' } });
  } catch (error) {
    console.error('[pagamento-sessao] Falha ao gerar cobrança:', error);
    return NextResponse.json(
      { error: 'Não foi possível gerar a cobrança desta sessão agora.' },
      { status: 500 }
    );
  }
}

