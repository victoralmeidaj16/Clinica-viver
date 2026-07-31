export type MoneyCents = number;

export type ChargeStatus =
  | 'draft'
  | 'pending'
  | 'partially_paid'
  | 'paid'
  | 'overdue'
  | 'cancelled'
  | 'refunded';

export type PaymentMethod = 'pix' | 'cash' | 'card' | 'bank_transfer' | 'other';
export type PaymentStatus = 'confirmed' | 'cancelled';
export type TransferStatus = 'pending' | 'paid' | 'cancelled';

export interface FinancialCharge {
  id: string;
  organizationId: string;
  sessionId: string;
  patientId: string;
  professionalId: string;
  issuedAt: string;
  dueAt: string;
  amountCents: MoneyCents;
  status: ChargeStatus;
  paymentMethod?: PaymentMethod;
  description?: string;
  providerReference?: string;
  createdAt: string;
  updatedAt: string;
}

export interface FinancialDiscount {
  id: string;
  chargeId: string;
  amountCents: MoneyCents;
  reason: string;
  appliedAt: string;
  createdBy: string;
}

export interface FinancialPayment {
  id: string;
  chargeId: string;
  receivedAt: string;
  amountCents: MoneyCents;
  method: PaymentMethod;
  status: PaymentStatus;
  provider?: 'asaas' | 'manual' | 'other';
  providerTransactionId?: string;
}

export interface FinancialRefund {
  id: string;
  paymentId: string;
  amountCents: MoneyCents;
  refundedAt: string;
  reason: string;
  providerReference?: string;
}

export interface FinancialFee {
  id: string;
  chargeId?: string;
  paymentId?: string;
  organizationId: string;
  type: 'provider' | 'banking' | 'tax' | 'platform' | 'other';
  amountCents: MoneyCents;
  incurredAt: string;
  description: string;
}

export interface FinancialTransfer {
  id: string;
  chargeId: string;
  professionalId: string;
  amountCents: MoneyCents;
  dueAt: string;
  status: TransferStatus;
  paidAt?: string;
  providerReference?: string;
}

export interface FinancialLedger {
  charges: readonly FinancialCharge[];
  discounts: readonly FinancialDiscount[];
  payments: readonly FinancialPayment[];
  refunds: readonly FinancialRefund[];
  fees: readonly FinancialFee[];
  transfers: readonly FinancialTransfer[];
}

export interface FinancialFilter {
  organizationId?: string;
  startDate?: string;
  endDate?: string;
  patientIds?: readonly string[];
  professionalIds?: readonly string[];
  chargeStatuses?: readonly ChargeStatus[];
  paymentMethods?: readonly PaymentMethod[];
}

export type ReconciliationStatus =
  | 'unpaid'
  | 'partial'
  | 'settled'
  | 'overpaid'
  | 'refunded'
  | 'cancelled';

export interface SessionReceivable {
  sessionId: string;
  chargeId: string;
  patientId: string;
  professionalId: string;
  dueAt: string;
  chargeStatus: ChargeStatus;
  reconciliationStatus: ReconciliationStatus;
  grossAmountCents: MoneyCents;
  discountAmountCents: MoneyCents;
  netAmountCents: MoneyCents;
  paidAmountCents: MoneyCents;
  refundedAmountCents: MoneyCents;
  outstandingAmountCents: MoneyCents;
  feeAmountCents: MoneyCents;
  transferAmountCents: MoneyCents;
}

export interface FinancialSummaryReport {
  generatedAt: string;
  period: { startDate?: string; endDate?: string };
  chargeCount: number;
  settledChargeCount: number;
  overdueChargeCount: number;
  grossBilledCents: MoneyCents;
  discountsCents: MoneyCents;
  netBilledCents: MoneyCents;
  receivedCents: MoneyCents;
  refundsCents: MoneyCents;
  feesCents: MoneyCents;
  transfersPaidCents: MoneyCents;
  netCashCents: MoneyCents;
  outstandingCents: MoneyCents;
  overdueCents: MoneyCents;
  delinquencyRate: number;
}

export interface CashFlowEntry {
  id: string;
  date: string;
  type: 'payment' | 'refund' | 'fee' | 'transfer';
  description: string;
  amountCents: MoneyCents;
}

export interface CashFlowReport {
  entries: readonly CashFlowEntry[];
  inflowCents: MoneyCents;
  outflowCents: MoneyCents;
  balanceCents: MoneyCents;
}

export interface DelinquencyReport {
  asOf: string;
  receivables: readonly SessionReceivable[];
  overdueCount: number;
  overdueCents: MoneyCents;
  delinquencyRate: number;
}

export interface TransferReport {
  transfers: readonly FinancialTransfer[];
  pendingCents: MoneyCents;
  paidCents: MoneyCents;
}

export interface FinancialReportBundle {
  summary: FinancialSummaryReport;
  receivables: readonly SessionReceivable[];
  cashFlow: CashFlowReport;
  delinquency: DelinquencyReport;
  transfers: TransferReport;
}
