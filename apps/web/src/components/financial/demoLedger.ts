import type { FinancialLedger } from '@thats-life/core';

export const people = {
  patients: { 'patient-1': 'Marina Costa', 'patient-2': 'Lucas Ribeiro', 'patient-3': 'Ana Souza' },
  professionals: { 'professional-1': 'Dra. Camila', 'professional-2': 'Dr. Rafael' },
};

export const demoLedger: FinancialLedger = {
  charges: [
    { id: 'charge-1', organizationId: 'org-demo', sessionId: 'session-101', patientId: 'patient-1', professionalId: 'professional-1', issuedAt: '2026-07-03T12:00:00.000Z', dueAt: '2026-07-03T23:59:00.000Z', amountCents: 25000, status: 'paid', paymentMethod: 'pix', createdAt: '2026-07-03T12:00:00.000Z', updatedAt: '2026-07-03T13:00:00.000Z' },
    { id: 'charge-2', organizationId: 'org-demo', sessionId: 'session-102', patientId: 'patient-2', professionalId: 'professional-1', issuedAt: '2026-07-10T12:00:00.000Z', dueAt: '2026-07-12T23:59:00.000Z', amountCents: 22000, status: 'partially_paid', paymentMethod: 'pix', createdAt: '2026-07-10T12:00:00.000Z', updatedAt: '2026-07-12T14:00:00.000Z' },
    { id: 'charge-3', organizationId: 'org-demo', sessionId: 'session-103', patientId: 'patient-3', professionalId: 'professional-2', issuedAt: '2026-07-18T12:00:00.000Z', dueAt: '2026-07-20T23:59:00.000Z', amountCents: 28000, status: 'pending', createdAt: '2026-07-18T12:00:00.000Z', updatedAt: '2026-07-18T12:00:00.000Z' },
    { id: 'charge-4', organizationId: 'org-demo', sessionId: 'session-104', patientId: 'patient-1', professionalId: 'professional-1', issuedAt: '2026-07-24T12:00:00.000Z', dueAt: '2026-08-02T23:59:00.000Z', amountCents: 25000, status: 'pending', createdAt: '2026-07-24T12:00:00.000Z', updatedAt: '2026-07-24T12:00:00.000Z' },
    { id: 'charge-5', organizationId: 'org-demo', sessionId: 'session-105', patientId: 'patient-2', professionalId: 'professional-2', issuedAt: '2026-07-29T12:00:00.000Z', dueAt: '2026-08-05T23:59:00.000Z', amountCents: 30000, status: 'pending', createdAt: '2026-07-29T12:00:00.000Z', updatedAt: '2026-07-29T12:00:00.000Z' },
  ],
  discounts: [{ id: 'discount-1', chargeId: 'charge-2', amountCents: 2000, reason: 'Ajuste social', appliedAt: '2026-07-10T12:00:00.000Z', createdBy: 'user-demo' }],
  payments: [
    { id: 'payment-1', chargeId: 'charge-1', receivedAt: '2026-07-03T13:00:00.000Z', amountCents: 25000, method: 'pix', status: 'confirmed', provider: 'manual' },
    { id: 'payment-2', chargeId: 'charge-2', receivedAt: '2026-07-12T14:00:00.000Z', amountCents: 10000, method: 'pix', status: 'confirmed', provider: 'manual' },
  ],
  refunds: [],
  fees: [{ id: 'fee-1', chargeId: 'charge-1', paymentId: 'payment-1', organizationId: 'org-demo', type: 'provider', amountCents: 249, incurredAt: '2026-07-03T13:00:00.000Z', description: 'Taxa Pix demonstrativa' }],
  transfers: [
    { id: 'transfer-1', chargeId: 'charge-1', professionalId: 'professional-1', amountCents: 17500, dueAt: '2026-07-05T12:00:00.000Z', status: 'paid', paidAt: '2026-07-05T12:00:00.000Z' },
    { id: 'transfer-2', chargeId: 'charge-2', professionalId: 'professional-1', amountCents: 14000, dueAt: '2026-08-05T12:00:00.000Z', status: 'pending' },
  ],
};
