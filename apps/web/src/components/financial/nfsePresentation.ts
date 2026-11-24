import { quitadaPelaEmpresa } from '@/lib/convenioBilling';

export type NfseRowStatus = 'none' | 'reserved' | 'processing' | 'issued' | 'failed' | 'cancelled';

export interface NfseRowAction {
  label: string;
  clickable: boolean;
  tone: 'muted' | 'ready' | 'progress' | 'success' | 'danger';
}

/** Estado textual único para a tabela financeira e para seus testes. */
export function nfseRowAction(input: {
  paymentStatus: string;
  nfseStatus: NfseRowStatus;
  isAdmin: boolean;
  numero?: string;
  /** Custeio da sessão, já descontada a cota quando há uma. */
  custeadoPelaEmpresa?: boolean;
  /** Fatura PJ que agrupou esta cobrança, quando houve uma. */
  faturaConvenioId?: string;
  /** Forma como a cobrança foi liquidada. */
  paymentMethod?: string;
}): NfseRowAction {
  const possuiRegistroFiscal = input.nfseStatus !== 'none';
  if (!input.isAdmin && (input.paymentStatus === 'paid' || possuiRegistroFiscal)) {
    return { label: 'Restrito à administração', clickable: false, tone: 'muted' };
  }
  // Consulta cancelada ou estornada não tem o que receber nem o que emitir.
  // Uma nota já emitida continua visível para a revisão fiscal.
  if (!possuiRegistroFiscal && (input.paymentStatus === 'cancelled' || input.paymentStatus === 'refunded')) {
    return { label: 'Não se aplica', clickable: false, tone: 'muted' };
  }
  if (!possuiRegistroFiscal && input.paymentStatus !== 'paid') {
    return { label: 'Aguardando pagamento', clickable: false, tone: 'muted' };
  }
  // A nota de quem a empresa pagou é uma só, emitida contra a fatura PJ. Emitir
  // por sessão aqui lançaria a mesma receita duas vezes e contra o tomador
  // errado — o paciente, que não pagou aquela sessão.
  if (!possuiRegistroFiscal && quitadaPelaEmpresa(input)) {
    return { label: 'NFS-e na fatura PJ', clickable: false, tone: 'muted' };
  }

  switch (input.nfseStatus) {
    case 'issued':
      return {
        label: input.numero ? `NFS-e nº ${input.numero}` : 'Ver NFS-e',
        clickable: true,
        tone: 'success',
      };
    case 'failed':
      return { label: 'Revisar falha', clickable: true, tone: 'danger' };
    case 'cancelled':
      return { label: 'NFS-e cancelada', clickable: true, tone: 'muted' };
    case 'reserved':
    case 'processing':
      return { label: 'Em processamento', clickable: true, tone: 'progress' };
    default:
      return { label: 'Gerar NFS-e', clickable: true, tone: 'ready' };
  }
}

/** Botão em base neutra; o tom vale só para o ícone (design.md). */
export const nfseRowTone: Record<NfseRowAction['tone'], string> = {
  muted: 'text-slate-400',
  ready: 'text-psi-vibrant',
  progress: 'text-slate-400',
  success: 'text-emerald-600',
  danger: 'text-rose-600',
};
