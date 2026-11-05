import { describe, expect, it } from 'vitest';
import { custeioAoAgendar, decideSessionCharge } from './sessionChargeRules';

describe('custeioAoAgendar', () => {
  it('a empresa paga sem limite: nenhuma sessão gera cobrança', () => {
    expect(custeioAoAgendar({ custeadoEfetivo: 1, cota: null })).toBe('empresa');
  });

  it('a empresa paga até um limite: sessões além dele ainda são cobradas', () => {
    expect(custeioAoAgendar({ custeadoEfetivo: 1, cota: 4 })).toBe('empresa_com_limite');
  });

  it('cota esgotada ou convênio sem custeio: quem paga é o paciente', () => {
    expect(custeioAoAgendar({ custeadoEfetivo: 0, cota: 4 })).toBe('paciente');
    expect(custeioAoAgendar({ custeadoEfetivo: 0, cota: null })).toBe('paciente');
  });
});

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
