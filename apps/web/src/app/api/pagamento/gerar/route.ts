import { NextResponse } from 'next/server';
import { createAsaasPayment, getOrCreateAsaasCustomer } from '@/server/adapters/asaasAdapter';
import { modalidadePorSlug } from '@/lib/modalidadesPagamento';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * Emite a cobrança de um link permanente.
 *
 * A rota é pública — é o paciente, sem conta no sistema, quem a chama. Por isso
 * o preço **não** vem do corpo da requisição: vem da modalidade, resolvida na
 * tabela do servidor. Aceitar um `valor` do cliente numa rota aberta é aceitar
 * que a sessão de R$ 130,00 seja paga por um centavo.
 */
export async function POST(request: Request) {
  try {
    const body = await request.json();
    const {
      psicologoId,
      psicologoNome,
      pacienteNome,
      pacienteCpf,
      pacienteWhatsapp,
      pacienteEmail,
      modalidade: modalidadeSlug,
      billingType,
    } = body;

    const modalidade = modalidadePorSlug(modalidadeSlug);
    if (!modalidade) {
      return NextResponse.json(
        { error: 'Modalidade de sessão inválida.' },
        { status: 400 }
      );
    }

    if (!pacienteNome || !String(pacienteNome).trim()) {
      return NextResponse.json(
        { error: 'O nome do paciente é obrigatório.' },
        { status: 400 }
      );
    }

    // 1. Criar ou buscar o cliente no Asaas
    const customerId = await getOrCreateAsaasCustomer({
      name: String(pacienteNome).trim(),
      cpfCnpj: pacienteCpf,
      mobilePhone: pacienteWhatsapp,
      email: pacienteEmail,
    });

    // 2. Vencimento no próprio dia, no fuso da clínica — `toISOString` daria o
    //    dia seguinte a partir das 21h de Brasília, e a cobrança nasceria com
    //    um dia de prazo que ninguém combinou.
    const dueDate = new Intl.DateTimeFormat('en-CA', {
      timeZone: 'America/Sao_Paulo',
    }).format(new Date());

    const descricao = `Sessão de Psicoterapia (${modalidade.rotulo}) - ${psicologoNome || 'Clínica Viver Mais'}`;

    // 3. Criar a cobrança no Asaas
    const payment = await createAsaasPayment({
      customerId,
      value: modalidade.valorCentavos / 100,
      dueDate,
      description: descricao,
      billingType: billingType || 'UNDEFINED',
      // A modalidade entra na referência externa para que a conciliação e o
      // webhook saibam, sem consultar mais nada, qual link originou o valor.
      externalReference: `PSI-${psicologoId || 'GERAL'}-${modalidade.slug.toLocaleUpperCase('en-US')}-${Date.now()}`,
    });

    return NextResponse.json({
      success: true,
      cobrancaId: payment.id,
      valor: payment.value,
      modalidade: modalidade.slug,
      invoiceUrl: payment.invoiceUrl,
      status: payment.status,
      pixQrCode: payment.pixQrCode?.encodedImage,
      pixCopiaECola: payment.pixQrCode?.payload,
    });
  } catch (error) {
    console.error('Erro na API /api/pagamento/gerar:', error);
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : 'Falha ao processar pagamento com o Asaas.',
      },
      { status: 500 }
    );
  }
}
