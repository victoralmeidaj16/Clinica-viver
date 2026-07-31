import type { FinancialCharge } from './types';
import { assertId, assertIsoDate, assertMoney } from './validation';

export interface CreateFinancialChargeInput {
  id: string;
  organizationId: string;
  sessionId: string;
  patientId: string;
  professionalId: string;
  issuedAt: string;
  dueAt: string;
  amountCents: number;
  description?: string;
  createdAt: string;
}

export function createFinancialCharge(
  input: CreateFinancialChargeInput
): FinancialCharge {
  assertId(input.id, 'id');
  assertId(input.organizationId, 'organizationId');
  assertId(input.sessionId, 'sessionId');
  assertId(input.patientId, 'patientId');
  assertId(input.professionalId, 'professionalId');
  assertIsoDate(input.issuedAt, 'issuedAt');
  assertIsoDate(input.dueAt, 'dueAt');
  assertIsoDate(input.createdAt, 'createdAt');
  assertMoney(input.amountCents, 'amountCents');

  if (Date.parse(input.dueAt) < Date.parse(input.issuedAt)) {
    throw new Error('dueAt não pode ser anterior a issuedAt.');
  }

  return {
    ...input,
    description: input.description?.trim() || undefined,
    status: 'pending',
    updatedAt: input.createdAt,
  };
}
