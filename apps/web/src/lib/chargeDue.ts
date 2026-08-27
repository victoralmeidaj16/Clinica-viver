import { FUSO_CLINICA } from './sessionReference';

const SETTLED_ASAAS_STATUSES = new Set([
  'RECEIVED',
  'CONFIRMED',
  'RECEIVED_IN_CASH',
  'REFUNDED',
]);

export function isFutureChargeDueAt(value: string, now: number = Date.now()): boolean {
  const parsed = Date.parse(value);
  return Number.isFinite(parsed) && parsed > now;
}

export function isChargeExpired(value: string, now: number = Date.now()): boolean {
  const parsed = Date.parse(value);
  return Number.isFinite(parsed) && parsed <= now;
}

export function asaasDueDate(value: string): string {
  if (!Number.isFinite(Date.parse(value))) throw new Error('Vencimento inválido.');
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: FUSO_CLINICA, year: 'numeric', month: '2-digit', day: '2-digit',
  }).format(new Date(value));
}

export function isAsaasPaymentSettled(status: string): boolean {
  return SETTLED_ASAAS_STATUSES.has(status);
}
