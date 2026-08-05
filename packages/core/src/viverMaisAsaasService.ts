import { LinkCobrancaAsaas, PsicologoPerfil, ModoAgendamentoCobranca } from './viverMaisTypes';

export interface CriarCobrancaParams {
  leadId: string;
  pacienteNome: string;
  psicologo: PsicologoPerfil;
  valorTotal: number; // Ex: R$ 75,00 ou R$ 130,00
  dataSessaoIso?: string;
  modoCobranca?: ModoAgendamentoCobranca;
}

/**
 * Calcula a divisão 70/30 (70% para abatimento de mensalidade do aluno, 30% margem da clínica).
 */
export function calcularSplit7030(valorTotal: number): { creditoAluno: number; receitaClinica: number } {
  const creditoAluno = Math.round(valorTotal * 0.7 * 100) / 100;
  const receitaClinica = Math.round((valorTotal - creditoAluno) * 100) / 100;
  return { creditoAluno, receitaClinica };
}

/**
 * Calcula a data de vencimento da cobrança (24h antes da sessão se for PRE_SESSAO_24H).
 */
export function calcularVencimentoCobranca(dataSessaoIso?: string, modo: ModoAgendamentoCobranca = 'PRE_SESSAO_24H'): string {
  if (!dataSessaoIso || modo === 'POS_SESSAO' || modo === 'MANUAL') {
    // Vencimento de 3 dias caso seja pós-sessão ou manual
    const d = new Date();
    d.setDate(d.getDate() + 3);
    return d.toISOString();
  }

  const sessaoDate = new Date(dataSessaoIso);
  // Subtrai 24 horas (1 dia)
  sessaoDate.setHours(sessaoDate.getHours() - 24);
  return sessaoDate.toISOString();
}

/**
 * Cria a cobrança com Link Único Asaas e o split 70/30.
 */
export function gerarLinkCobrancaAsaas(params: CriarCobrancaParams): LinkCobrancaAsaas {
  const { creditoAluno, receitaClinica } = calcularSplit7030(params.valorTotal);
  const idCobranca = `PAY-${Math.floor(10000 + Math.random() * 90000)}`;

  return {
    id: idCobranca,
    leadId: params.leadId,
    pacienteNome: params.pacienteNome,
    psicologoId: params.psicologo.id,
    psicologoNome: params.psicologo.nome,
    valorTotal: params.valorTotal,
    valorCreditoAluno: creditoAluno,
    valorReceitaClinica: receitaClinica,
    checkoutUrl: `https://vivermais.com.br/p/${idCobranca}`,
    pixCopiaECola: `00020126580014BR.GOV.BCB.PIX0136vivermais-${idCobranca}520400005303986540${params.valorTotal.toFixed(2)}5802BR`,
    pixQrCodeUrl: `https://api.qrserver.com/v1/create-qr-code/?size=250x250&data=vivermais-${idCobranca}`,
    status: 'PENDENTE',
    criadoEm: new Date().toISOString(),
  };
}

/**
 * Gera mensagem da Régua de Inadimplência para WhatsApp quando o pagamento atrasar.
 */
export function gerarMensagemCobrancaAtrasadaWhatsApp(
  pacienteNome: string,
  cobranca: LinkCobrancaAsaas
): string {
  return `📩 *Lembrete de Pagamento — Clínica Viver Mais Psicologia*\n\n` +
    `Olá, ${pacienteNome}! Identificamos que o pagamento da sua sessão com ${cobranca.psicologoNome} ` +
    `no valor de R$ ${cobranca.valorTotal.toFixed(2).replace('.', ',')} encontra-se em aberto.\n\n` +
    `Para manter seu agendamento e a emissão da Nota Fiscal, acesse o link seguro para efetuar o pagamento via Pix ou Cartão:\n` +
    `👉 ${cobranca.checkoutUrl}\n\n` +
    `Qualquer dúvida, estamos à disposição!`;
}

/**
 * Processa o webhook de pagamento do Asaas e credita os 70% no saldo do aluno.
 */
export function processarWebhookPagamentoAsaas(
  cobranca: LinkCobrancaAsaas,
  psicologo: PsicologoPerfil
): { cobrancaAtualizada: LinkCobrancaAsaas; psicologoAtualizado: PsicologoPerfil } {
  const agoraIso = new Date().toISOString();

  const cobrancaAtualizada: LinkCobrancaAsaas = {
    ...cobranca,
    status: 'PAGO',
    pagoEm: agoraIso,
    transacaoIdAsaas: `TX-${Date.now()}`,
  };

  const psicologoAtualizado: PsicologoPerfil = {
    ...psicologo,
    saldoCreditoAbatimento: psicologo.saldoCreditoAbatimento + cobranca.valorCreditoAluno,
  };

  return { cobrancaAtualizada, psicologoAtualizado };
}
