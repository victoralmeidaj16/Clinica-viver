/** Formatação compartilhada; os valores reais vêm do perfil no MySQL. */

export function reaisDeCentavos(centavos: number): string {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(centavos / 100);
}

/** Rótulo único para a forma de pagamento em todas as visões financeiras. */
export function rotuloFormaPagamento(forma?: string): string {
  switch (forma) {
    // Crédito de sessão custeada por empresa: nasce na confirmação, sem pagamento do paciente.
    case 'convenio':
      return 'Convênio (sessão confirmada)';
    case 'pix':
      return 'Pix';
    case 'card':
      return 'Cartão de crédito/débito';
    case 'boleto':
      return 'Boleto';
    case 'cash':
      return 'Dinheiro';
    case 'bank_transfer':
      return 'Transferência bancária';
    case 'other':
      return 'Outro';
    default:
      return 'Não informado';
  }
}

/** Só cobranças ainda liquidáveis devem oferecer link ou ação de pagamento. */
export function permiteNovoPagamento(status?: string): boolean {
  return !['paid', 'refunded', 'cancelled'].includes(status ?? '');
}
