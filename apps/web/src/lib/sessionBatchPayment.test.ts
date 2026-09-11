import { describe, expect, it } from 'vitest';
import { priceSessionBatch, sessionBatchPaymentRule } from './sessionBatchPayment';
import { allocatePaymentAcrossCharges } from './paymentAllocation';

const now = new Date('2026-09-01T03:00:00Z');
const sessions = (count: number, start = '2026-09-15T15:00:00Z', amountCents = 10000) =>
  Array.from({ length: count }, () => ({ sessionStart: start, amountCents }));

describe('pagamento único mensal', () => {
  it.each([1, 2, 3])('%i sessões não recebem desconto', (count) => {
    expect(priceSessionBatch(sessions(count), now).discountCents).toBe(0);
  });
  it.each([4, 5, 10])('%i sessões do mês vigente recebem 10%', (count) => {
    expect(priceSessionBatch(sessions(count), now).amountCents).toBe(count * 9000);
  });
  it.each(['2026-08-15T15:00:00Z', '2026-10-15T15:00:00Z', '2027-09-15T15:00:00Z'])(
    'bloqueia grupo de outro mês/ano: %s', (start) => {
      expect(() => priceSessionBatch(sessions(4, start), now)).toThrow('mês vigente');
      expect(() => priceSessionBatch([...sessions(3), ...sessions(1, start)], now)).toThrow('mês vigente');
    }
  );
  it('usa a virada do mês em São Paulo, não UTC', () => {
    expect(sessionBatchPaymentRule(sessions(4, '2026-10-01T02:59:59Z').map((s) => s.sessionStart), now).discountPercent).toBe(10);
    expect(sessionBatchPaymentRule(sessions(4, '2026-10-01T03:00:00Z').map((s) => s.sessionStart), now).error).toBeDefined();
  });
  it('preserva centavos no rateio e quita todas as sessões pelo total líquido', () => {
    const result = priceSessionBatch(sessions(4, undefined, 10003), now);
    expect(result.discountCents).toBe(4001);
    expect(result.amounts.reduce((sum, amount) => sum + amount, 0)).toBe(result.amountCents);
    const allocations = allocatePaymentAcrossCharges(result.amountCents, result.amounts.map((amountCents, index) => ({ reference: String(index), amountCents })));
    expect(allocations).toHaveLength(4);
    expect(allocations.every((item) => item.fullyPaid)).toBe(true);
  });
});
