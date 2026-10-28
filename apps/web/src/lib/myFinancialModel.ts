import type { SessionEditableData } from '@/components/scheduling/editSessionModel';

export interface Transaction {
  id: string;
  patientName: string;
  receivedAt: string;
  amountCents: number;
  professionalCreditCents: number;
  clinicRevenueCents: number;
  method: string;
}

export type PaymentStatus = 'draft' | 'paid' | 'pending' | 'partially_paid' | 'overdue' | 'refunded' | 'cancelled';

export interface Receivable {
  chargeId: string;
  sessionId: string;
  appointmentId?: string;
  serviceKey?: string;
  versao?: number;
  patientName: string;
  dueAt: string;
  startsAt?: string;
  endsAt?: string;
  status: PaymentStatus;
  attendanceStatus?: 'a_confirmar' | 'realizado' | 'cancelado';
  modalidade?: 'online' | 'presencial' | 'telefone';
  conveniado?: boolean;
  convenioNome?: string;
  custeadoPelaEmpresa?: boolean;
  /** Caminho público da cobrança (`/pagar/sessao/...`), quando a sessão tem uma. */
  paymentLink?: string;
  paymentMethod?: string;
  amountCents: number;
  receivedCents: number;
  outstandingCents: number;
}

export interface FinancialData {
  receivedCents: number;
  professionalCreditCents: number;
  transactions: Transaction[];
  receivables: Receivable[];
}

export function financialSessionForEdit(item: Receivable): SessionEditableData {
  const isCancelado = item.attendanceStatus === 'cancelado';
  const isRealizado = item.attendanceStatus === 'realizado';

  return {
    id: item.appointmentId || item.sessionId,
    pacienteNome: item.patientName,
    inicio: item.startsAt || item.dueAt,
    fim: item.endsAt,
    serviceKey: item.serviceKey,
    versao: item.versao,
    modalidade: item.modalidade || 'online',
    status: isRealizado ? 'realizado' : (isCancelado ? 'cancelado' : 'agendado'),
    custeadoPelaEmpresa: item.custeadoPelaEmpresa,
    convenioNome: item.convenioNome,
  };
}
