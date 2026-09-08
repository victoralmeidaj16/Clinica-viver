import { describe, expect, it } from 'vitest';
import { allocatePaymentAcrossCharges } from './paymentAllocation';

describe('rateio de pagamento agrupado', () => {
  const charges = [{ reference: 'a', amountCents: 13000 }, { reference: 'b', amountCents: 13000 }];

  it('quita integralmente cada sessão quando o total foi recebido', () => {
    expect(allocatePaymentAcrossCharges(26000, charges)).toEqual([
      { reference: 'a', amountCents: 13000, fullyPaid: true },
      { reference: 'b', amountCents: 13000, fullyPaid: true },
    ]);
  });

  it('não credita valor inexistente em liquidação parcial', () => {
    expect(allocatePaymentAcrossCharges(15000, charges)).toEqual([
      { reference: 'a', amountCents: 13000, fullyPaid: true },
      { reference: 'b', amountCents: 2000, fullyPaid: false },
    ]);
  });
});
