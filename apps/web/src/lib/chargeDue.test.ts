import { describe, expect, it } from 'vitest';
import {
  asaasDueDate,
  isAsaasPaymentSettled,
  isChargeExpired,
  isFutureChargeDueAt,
} from './chargeDue';

describe('vencimento exato da cobrança', () => {
  const now = Date.parse('2026-08-26T15:00:00.000Z');

  it('aceita antes, no momento ou depois da sessão, desde que ainda esteja no futuro', () => {
    expect(isFutureChargeDueAt('2026-08-26T15:00:01.000Z', now)).toBe(true);
    expect(isFutureChargeDueAt('2026-08-26T15:00:00.000Z', now)).toBe(false);
    expect(isFutureChargeDueAt('2026-08-26T14:59:59.000Z', now)).toBe(false);
  });

  it('considera expirado exatamente no instante configurado', () => {
    expect(isChargeExpired('2026-08-26T15:00:00.000Z', now)).toBe(true);
    expect(isChargeExpired('2026-08-26T15:00:01.000Z', now)).toBe(false);
  });

  it('envia ao Asaas o dia civil de São Paulo', () => {
    expect(asaasDueDate('2026-08-27T01:30:00.000Z')).toBe('2026-08-26');
  });

  it.each(['RECEIVED', 'CONFIRMED', 'RECEIVED_IN_CASH', 'REFUNDED'])(
    'nunca remove no Asaas uma cobrança liquidada com status %s',
    (status) => expect(isAsaasPaymentSettled(status)).toBe(true)
  );

  it('permite expirar somente estados remotos ainda abertos', () => {
    expect(isAsaasPaymentSettled('PENDING')).toBe(false);
    expect(isAsaasPaymentSettled('OVERDUE')).toBe(false);
  });
});
