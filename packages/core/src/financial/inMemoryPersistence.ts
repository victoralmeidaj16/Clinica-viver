import { filterChargesByIssuedPeriod, filterChargesByScope } from './filters';
import type {
  FinancialAuditEvent,
  FinancialAuditRepository,
  FinancialRepository,
  IdempotencyRepository,
} from './ports';
import type {
  FinancialCharge,
  FinancialDiscount,
  FinancialFee,
  FinancialFilter,
  FinancialLedger,
  FinancialPayment,
  FinancialRefund,
  FinancialTransfer,
} from './types';

function upsert<T extends { id: string }>(collection: T[], value: T): void {
  const index = collection.findIndex(({ id }) => id === value.id);
  if (index >= 0) collection[index] = structuredClone(value);
  else collection.push(structuredClone(value));
}

export class InMemoryFinancialRepository implements FinancialRepository {
  private readonly charges: FinancialCharge[];
  private readonly discounts: FinancialDiscount[];
  private readonly payments: FinancialPayment[];
  private readonly refunds: FinancialRefund[];
  private readonly fees: FinancialFee[];
  private readonly transfers: FinancialTransfer[];

  constructor(initial: Partial<FinancialLedger> = {}) {
    this.charges = Array.from(initial.charges ?? [], (item) => structuredClone(item));
    this.discounts = Array.from(initial.discounts ?? [], (item) =>
      structuredClone(item)
    );
    this.payments = Array.from(initial.payments ?? [], (item) =>
      structuredClone(item)
    );
    this.refunds = Array.from(initial.refunds ?? [], (item) =>
      structuredClone(item)
    );
    this.fees = Array.from(initial.fees ?? [], (item) => structuredClone(item));
    this.transfers = Array.from(initial.transfers ?? [], (item) =>
      structuredClone(item)
    );
  }

  async getLedger(filter: FinancialFilter): Promise<FinancialLedger> {
    const completeLedger = this.snapshot();
    const scopedCharges = filterChargesByIssuedPeriod(
      filterChargesByScope(completeLedger, filter),
      filter
    );
    const chargeIds = new Set(scopedCharges.map(({ id }) => id));
    const scopedPayments = this.payments.filter(({ chargeId }) =>
      chargeIds.has(chargeId)
    );
    const paymentIds = new Set(scopedPayments.map(({ id }) => id));

    return structuredClone({
      charges: scopedCharges,
      discounts: this.discounts.filter(({ chargeId }) => chargeIds.has(chargeId)),
      payments: scopedPayments,
      refunds: this.refunds.filter(({ paymentId }) => paymentIds.has(paymentId)),
      fees: this.fees.filter(
        (fee) =>
          (fee.chargeId ? chargeIds.has(fee.chargeId) : true) &&
          (!filter.organizationId || fee.organizationId === filter.organizationId)
      ),
      transfers: this.transfers.filter(({ chargeId }) => chargeIds.has(chargeId)),
    });
  }

  async getChargeById(id: string): Promise<FinancialCharge | null> {
    const charge = this.charges.find((item) => item.id === id);
    return charge ? structuredClone(charge) : null;
  }

  async getChargeByProviderReference(
    reference: string
  ): Promise<FinancialCharge | null> {
    const charge = this.charges.find(
      ({ providerReference }) => providerReference === reference
    );
    return charge ? structuredClone(charge) : null;
  }

  async saveCharge(charge: FinancialCharge): Promise<void> {
    upsert(this.charges, charge);
  }

  async saveDiscount(discount: FinancialDiscount): Promise<void> {
    upsert(this.discounts, discount);
  }

  async savePayment(payment: FinancialPayment): Promise<void> {
    upsert(this.payments, payment);
  }

  async saveRefund(refund: FinancialRefund): Promise<void> {
    upsert(this.refunds, refund);
  }

  async saveFee(fee: FinancialFee): Promise<void> {
    upsert(this.fees, fee);
  }

  async saveTransfer(transfer: FinancialTransfer): Promise<void> {
    upsert(this.transfers, transfer);
  }

  snapshot(): FinancialLedger {
    return structuredClone({
      charges: this.charges,
      discounts: this.discounts,
      payments: this.payments,
      refunds: this.refunds,
      fees: this.fees,
      transfers: this.transfers,
    });
  }
}

export class InMemoryFinancialAuditRepository
  implements FinancialAuditRepository
{
  private readonly events: FinancialAuditEvent[] = [];

  async append(event: FinancialAuditEvent): Promise<void> {
    if (this.events.some(({ id }) => id === event.id)) {
      throw new Error(`Evento de auditoria duplicado: ${event.id}.`);
    }
    this.events.push(structuredClone(event));
  }

  async list(
    organizationId: string,
    startDate?: string,
    endDate?: string
  ): Promise<readonly FinancialAuditEvent[]> {
    return structuredClone(
      this.events.filter(
        (event) =>
          event.organizationId === organizationId &&
          (!startDate || Date.parse(event.occurredAt) >= Date.parse(startDate)) &&
          (!endDate || Date.parse(event.occurredAt) <= Date.parse(endDate))
      )
    );
  }
}

export class InMemoryIdempotencyRepository
  implements IdempotencyRepository
{
  private readonly keys = new Set<string>();

  async hasProcessed(scope: string, key: string): Promise<boolean> {
    return this.keys.has(`${scope}:${key}`);
  }

  async markProcessed(scope: string, key: string): Promise<void> {
    this.keys.add(`${scope}:${key}`);
  }
}
