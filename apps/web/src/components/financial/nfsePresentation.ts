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

export const nfseRowTone: Record<NfseRowAction['tone'], string> = {
  muted: 'border-line bg-slate-50 text-muted',
  ready: 'border-psi-vibrant/30 bg-psi-soft/40 text-psi-deep hover:bg-psi-soft',
  progress: 'border-sky-200 bg-sky-50 text-sky-800 hover:bg-sky-100',
  success: 'border-emerald-200 bg-emerald-50 text-emerald-800 hover:bg-emerald-100',
  danger: 'border-rose-200 bg-rose-50 text-rose-800 hover:bg-rose-100',
};
