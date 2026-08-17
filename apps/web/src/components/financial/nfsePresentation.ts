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
}): NfseRowAction {
  const possuiRegistroFiscal = input.nfseStatus !== 'none';
  if (!input.isAdmin && (input.paymentStatus === 'paid' || possuiRegistroFiscal)) {
    return { label: 'Restrito à administração', clickable: false, tone: 'muted' };
  }
  if (!possuiRegistroFiscal && input.paymentStatus !== 'paid') {
    return { label: 'Aguardando pagamento', clickable: false, tone: 'muted' };
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
