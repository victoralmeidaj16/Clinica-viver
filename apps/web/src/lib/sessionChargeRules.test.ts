import { describe, expect, it } from 'vitest';
import { decideSessionCharge } from './sessionChargeRules';

describe('decideSessionCharge', () => {
  it('cria cobrança para uma sessão particular com valor congelado', () => {
    expect(decideSessionCharge({ amountCents: 13000, companyFunded: false }))
      .toEqual({ create: true, amountCents: 13000 });
  });

  it('não cria cobrança individual para convênio custeado pela empresa', () => {
    expect(decideSessionCharge({ amountCents: 13000, companyFunded: true }))
      .toEqual({ create: false, reason: 'company_funded' });
  });

  it.each([null, undefined, 0, -1, 'inválido'])(
    'não inventa cobrança quando o valor é %s',
    (amountCents) => {
      expect(decideSessionCharge({ amountCents, companyFunded: false }))
        .toEqual({ create: false, reason: 'missing_amount' });
    }
  );
});
