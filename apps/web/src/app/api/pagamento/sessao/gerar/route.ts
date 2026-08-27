import { NextResponse } from 'next/server';
import {
  createAsaasPayment,
  findAsaasPaymentByExternalReference,
  getAsaasPayment,
  getOrCreateAsaasCustomer,
} from '@/server/adapters/asaasAdapter';
import {
  createInterPixCharge,
  getInterPixCharge,
} from '@/server/adapters/interPixAdapter';
import { rateLimited, validCpf } from '@/server/http/publicRequest';
import {
  bindProviderPayment,
  claimCheckoutProvider,
  isCompanyFundedReservation,
  isExpiredReservation,
  reserveAppointmentCharge,
} from '@/server/payments/paymentLinkRepository';
import { asaasDueDate } from '@/lib/chargeDue';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

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
    const paymentMethod = String(body.paymentMethod ?? '');
    if (!/^[a-f0-9]{32}$/.test(token)) {
      return NextResponse.json({ error: 'Link de pagamento inválido.' }, { status: 404 });
    }
    if (!validCpf(cpf)) {
      return NextResponse.json({ error: 'Informe um CPF válido.' }, { status: 400 });
    }
    if (!['PIX', 'CREDIT_CARD'].includes(paymentMethod)) {
      return NextResponse.json({ error: 'Escolha Pix ou cartão de crédito.' }, { status: 400 });
    }

    const checkout = await reserveAppointmentCharge({ token, cpf });
    if (!checkout) {
      return NextResponse.json(
        { error: 'O CPF não corresponde ao paciente desta sessão. Confira os dados.' },
        { status: 404 }
      );
    }
    if (isCompanyFundedReservation(checkout)) {
      return NextResponse.json({
        fundedByCompany: true,
        companyName: checkout.companyName,
        message: 'Esta sessão é custeada pela sua empresa - não há nada a pagar.',
      }, { headers: { 'Cache-Control': 'private, no-store' } });
    }
    if (isExpiredReservation(checkout)) {
      return NextResponse.json({
        error: 'O prazo para pagamento desta sessão terminou.',
        expired: true,
        dueAt: checkout.dueAt,
      }, { status: 410, headers: { 'Cache-Control': 'private, no-store' } });
    }

    const requestedProvider = paymentMethod === 'PIX' ? 'inter' : 'asaas';
    const existingProvider = checkout.provider ?? (checkout.providerPaymentId ? 'asaas' : undefined)
      ?? await claimCheckoutProvider(checkout.externalReference, requestedProvider);
    if (existingProvider && existingProvider !== requestedProvider) {
      return NextResponse.json({
        error: existingProvider === 'inter'
          ? 'Este pagamento já foi iniciado via Pix. Use o QR Code já gerado.'
          : 'Este pagamento já foi iniciado no cartão. Continue pelo link do Asaas.',
      }, { status: 409, headers: { 'Cache-Control': 'private, no-store' } });
    }

    if (paymentMethod === 'PIX') {
      const pix = checkout.providerPaymentId
        ? await getInterPixCharge(checkout.providerPaymentId)
        : await createInterPixCharge({
          externalReference: checkout.externalReference,
          amountCents: checkout.amountCents,
          patientName: checkout.patientName,
          patientCpf: checkout.patientCpf,
          description: checkout.description ?? `Sessão de Psicoterapia - ${checkout.professionalName}`,
          dueAt: checkout.dueAt,
        });
      await bindProviderPayment(checkout, pix.id, 'pix', 'inter');
      return NextResponse.json({
        success: true,
        provider: 'inter',
        paymentMethod: 'PIX',
        cobrancaId: pix.id,
        pacienteNome: checkout.patientName,
        sessaoInicio: checkout.sessionStart,
        valor: pix.value,
        status: pix.status,
        pixQrCode: pix.pixQrCode,
        pixCopiaECola: pix.pixCopiaECola,
      }, { headers: { 'Cache-Control': 'private, no-store' } });
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
      const dueDate = asaasDueDate(checkout.dueAt);
      payment = await createAsaasPayment({
        customerId,
        value: checkout.amountCents / 100,
        dueDate,
        description: checkout.description ?? `Sessão de Psicoterapia - ${checkout.professionalName}`,
        billingType: 'CREDIT_CARD',
        externalReference: checkout.externalReference,
      });
    }

    await bindProviderPayment(checkout, payment.id, 'card', 'asaas');
    return NextResponse.json({
      success: true,
      provider: 'asaas',
      paymentMethod: 'CREDIT_CARD',
      cobrancaId: payment.id,
      pacienteNome: checkout.patientName,
      sessaoInicio: checkout.sessionStart,
      valor: payment.value,
      invoiceUrl: payment.invoiceUrl,
      status: payment.status,
    }, { headers: { 'Cache-Control': 'private, no-store' } });
  } catch (error) {
    console.error('[pagamento-sessao] Falha ao gerar cobrança:', error);
    return NextResponse.json(
      { error: 'Não foi possível gerar a cobrança desta sessão agora.' },
      { status: 500 }
    );
  }
}
