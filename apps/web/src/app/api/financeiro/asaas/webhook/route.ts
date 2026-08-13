import { NextResponse } from 'next/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const ASAAS_WEBHOOK_TOKEN = process.env.ASAAS_WEBHOOK_TOKEN || 'VIVERMAISPSICOLOGIA0101.';

export async function POST(request: Request) {
  try {
    // 1. Validar token de autenticação do Webhook
    const tokenHeader = request.headers.get('asaas-access-token');
    if (tokenHeader && tokenHeader !== ASAAS_WEBHOOK_TOKEN) {
      console.warn('Tentativa de Webhook com token inválido:', tokenHeader);
      return NextResponse.json({ error: 'Não autorizado.' }, { status: 401 });
    }

    const payload = await request.json();
    const event = payload.event;
    const payment = payload.payment;

    console.log(`[Asaas Webhook] Evento recebido: ${event} para cobrança ${payment?.id}`);

    if (event === 'PAYMENT_CONFIRMED' || event === 'PAYMENT_RECEIVED') {
      const valorBruto = payment.value || 0;
      const creditoPsicologo70 = Math.round(valorBruto * 0.7 * 100) / 100;
      const receitaClinica30 = Math.round((valorBruto - creditoPsicologo70) * 100) / 100;

      console.log(`[Asaas Webhook] Pagamento Confirmado!`, {
        cobrancaId: payment.id,
        valorBruto,
        creditoPsicologo70,
        receitaClinica30,
        cliente: payment.customer,
        externalReference: payment.externalReference,
      });

      // Aqui registramos o histórico em relatórios/banco de dados
    }

    return NextResponse.json({ received: true });
  } catch (error) {
    console.error('Erro ao processar Webhook do Asaas:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Falha ao processar Webhook.' },
      { status: 500 }
    );
  }
}
