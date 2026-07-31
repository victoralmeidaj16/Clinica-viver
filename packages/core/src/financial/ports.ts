import type {
  FinancialCharge,
  FinancialDiscount,
  FinancialFee,
  FinancialFilter,
  FinancialLedger,
  FinancialPayment,
  FinancialRefund,
  FinancialTransfer,
  MoneyCents,
  PaymentMethod,
} from './types';

export interface FinancialAuditEvent {
  id: string;
  organizationId: string;
  actorId: string;
  action:
    | 'charge.created'
    | 'charge.updated'
    | 'payment.confirmed'
    | 'refund.confirmed'
    | 'transfer.paid'
    | 'fiscal_document.issued'
    | 'report.exported'
    | 'webhook.received';
  entityType: string;
  entityId: string;
  occurredAt: string;
  correlationId?: string;
  metadata?: Readonly<Record<string, string | number | boolean>>;
}

export interface FinancialRepository {
  getLedger(filter: FinancialFilter): Promise<FinancialLedger>;
  getChargeById(id: string): Promise<FinancialCharge | null>;
  getChargeByProviderReference(reference: string): Promise<FinancialCharge | null>;
  saveCharge(charge: FinancialCharge): Promise<void>;
  saveDiscount(discount: FinancialDiscount): Promise<void>;
  savePayment(payment: FinancialPayment): Promise<void>;
  saveRefund(refund: FinancialRefund): Promise<void>;
  saveFee(fee: FinancialFee): Promise<void>;
  saveTransfer(transfer: FinancialTransfer): Promise<void>;
}

export interface FinancialAuditRepository {
  append(event: FinancialAuditEvent): Promise<void>;
  list(
    organizationId: string,
    startDate?: string,
    endDate?: string
  ): Promise<readonly FinancialAuditEvent[]>;
}

export interface CreateProviderChargeInput {
  externalReference: string;
  patientReference: string;
  amountCents: MoneyCents;
  dueAt: string;
  method: PaymentMethod;
  description: string;
}

export interface ProviderChargeResult {
  provider: 'asaas' | 'other';
  providerChargeId: string;
  status: 'pending' | 'paid' | 'cancelled';
  pixCopyAndPaste?: string;
  qrCodeImageUrl?: string;
  invoiceUrl?: string;
}

export type NormalizedBillingWebhook =
  | {
      type: 'payment.confirmed';
      providerEventId: string;
      providerChargeId: string;
      providerPaymentId: string;
      amountCents: MoneyCents;
      occurredAt: string;
    }
  | {
      type: 'payment.refunded';
      providerEventId: string;
      providerChargeId: string;
      providerPaymentId: string;
      amountCents: MoneyCents;
      occurredAt: string;
    }
  | {
      type: 'charge.cancelled';
      providerEventId: string;
      providerChargeId: string;
      occurredAt: string;
    };

export interface BillingProviderPort {
  createCharge(input: CreateProviderChargeInput): Promise<ProviderChargeResult>;
  cancelCharge(providerChargeId: string): Promise<void>;
  refundPayment(
    providerPaymentId: string,
    amountCents: MoneyCents
  ): Promise<{ providerRefundId: string }>;
  verifyAndNormalizeWebhook(
    headers: Readonly<Record<string, string>>,
    rawBody: Uint8Array
  ): Promise<NormalizedBillingWebhook>;
}

export interface FiscalParty {
  taxId: string;
  name: string;
  email?: string;
  address?: string;
}

export interface IssueFiscalDocumentInput {
  externalReference: string;
  organizationId: string;
  issuer: FiscalParty;
  recipient: FiscalParty;
  serviceDate: string;
  amountCents: MoneyCents;
  description: string;
}

export interface IssuedFiscalDocument {
  providerDocumentId: string;
  type: 'nfse' | 'receita_saude';
  status: 'processing' | 'issued' | 'cancelled' | 'failed';
  issuedAt?: string;
  documentUrl?: string;
  verificationCode?: string;
}

export interface FiscalDocumentPort {
  issueNfse(input: IssueFiscalDocumentInput): Promise<IssuedFiscalDocument>;
  issueReceitaSaude(
    input: IssueFiscalDocumentInput
  ): Promise<IssuedFiscalDocument>;
  cancel(
    providerDocumentId: string,
    reason: string
  ): Promise<IssuedFiscalDocument>;
}

export interface IdempotencyRepository {
  hasProcessed(scope: string, key: string): Promise<boolean>;
  markProcessed(scope: string, key: string, processedAt: string): Promise<void>;
}

export interface FinancialPdfExporterPort<TDocument> {
  export(document: TDocument): Promise<Uint8Array>;
}
