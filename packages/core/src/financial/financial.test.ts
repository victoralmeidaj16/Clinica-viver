import { describe, expect, it } from 'vitest';
import { createFinancialAuditEvent } from './audit';
import { createFinancialCharge } from './chargeFactory';
import { exportFinancialReportCsv } from './csv';
import { InMemoryFinancialRepository } from './inMemoryPersistence';
import { exportFinancialReportPdf } from './pdf';
import { reconcileSessionReceivables } from './reconciliation';
import { generateFinancialReports } from './reports';
import type { FinancialLedger } from './types';

const ledger: FinancialLedger = {
  charges: [
    {
      id: 'charge-1',
      organizationId: 'org-1',
      sessionId: 'session-1',
      patientId: 'patient-1',
      professionalId: 'professional-1',
      issuedAt: '2026-07-01T12:00:00.000Z',
      dueAt: '2026-07-10T23:59:59.000Z',
      amountCents: 30_000,
      status: 'pending',
      createdAt: '2026-07-01T12:00:00.000Z',
      updatedAt: '2026-07-01T12:00:00.000Z',
    },
    {
      id: 'charge-2',
      organizationId: 'org-1',
      sessionId: 'session-2',
      patientId: 'patient-2',
      professionalId: 'professional-1',
      issuedAt: '2026-07-02T12:00:00.000Z',
      dueAt: '2026-07-15T23:59:59.000Z',
      amountCents: 20_000,
      status: 'pending',
      createdAt: '2026-07-02T12:00:00.000Z',
      updatedAt: '2026-07-02T12:00:00.000Z',
    },
    {
      id: 'charge-3',
      organizationId: 'org-1',
      sessionId: 'session-3',
      patientId: 'patient-1',
      professionalId: 'professional-2',
      issuedAt: '2026-07-03T12:00:00.000Z',
      dueAt: '2026-07-20T23:59:59.000Z',
      amountCents: 10_000,
      status: 'pending',
      createdAt: '2026-07-03T12:00:00.000Z',
      updatedAt: '2026-07-03T12:00:00.000Z',
    },
  ],
  discounts: [
    {
      id: 'discount-1',
      chargeId: 'charge-1',
      amountCents: 5_000,
      reason: 'Acordo',
      appliedAt: '2026-07-01T13:00:00.000Z',
      createdBy: 'user-1',
    },
  ],
  payments: [
    {
      id: 'payment-1',
      chargeId: 'charge-1',
      receivedAt: '2026-07-05T12:00:00.000Z',
      amountCents: 25_000,
      method: 'pix',
      status: 'confirmed',
    },
    {
      id: 'payment-2',
      chargeId: 'charge-2',
      receivedAt: '2026-07-06T12:00:00.000Z',
      amountCents: 5_000,
      method: 'cash',
      status: 'confirmed',
    },
    {
      id: 'payment-3',
      chargeId: 'charge-3',
      receivedAt: '2026-07-07T12:00:00.000Z',
      amountCents: 10_000,
      method: 'pix',
      status: 'confirmed',
    },
  ],
  refunds: [
    {
      id: 'refund-1',
      paymentId: 'payment-3',
      amountCents: 10_000,
      refundedAt: '2026-07-08T12:00:00.000Z',
      reason: 'Sessão cancelada',
    },
  ],
  fees: [
    {
      id: 'fee-1',
      chargeId: 'charge-1',
      paymentId: 'payment-1',
      organizationId: 'org-1',
      type: 'provider',
      amountCents: 1_000,
      incurredAt: '2026-07-05T12:00:00.000Z',
      description: 'Taxa Pix',
    },
  ],
  transfers: [
    {
      id: 'transfer-1',
      chargeId: 'charge-1',
      professionalId: 'professional-1',
      amountCents: 15_000,
      dueAt: '2026-07-06T12:00:00.000Z',
      status: 'paid',
      paidAt: '2026-07-06T12:00:00.000Z',
    },
  ],
};

describe('financial domain', () => {
  it('cria cobrança usando centavos inteiros', () => {
    const charge = createFinancialCharge({
      id: 'charge-new',
      organizationId: 'org-1',
      sessionId: 'session-new',
      patientId: 'patient-1',
      professionalId: 'professional-1',
      issuedAt: '2026-07-30T12:00:00.000Z',
      dueAt: '2026-08-01T12:00:00.000Z',
      amountCents: 25_000,
      createdAt: '2026-07-30T12:00:00.000Z',
    });

    expect(charge.status).toBe('pending');
    expect(charge.amountCents).toBe(25_000);
    expect(() =>
      createFinancialCharge({
        ...charge,
        id: 'invalid',
        sessionId: 'invalid',
        amountCents: 250.5,
      })
    ).toThrow('centavos inteiros');
  });

  it('concilia descontos, pagamentos, estornos, taxas e repasses por sessão', () => {
    const receivables = reconcileSessionReceivables(ledger);

    expect(receivables[0]).toMatchObject({
      netAmountCents: 25_000,
      paidAmountCents: 25_000,
      outstandingAmountCents: 0,
      feeAmountCents: 1_000,
      transferAmountCents: 15_000,
      reconciliationStatus: 'settled',
    });
    expect(receivables[1].reconciliationStatus).toBe('partial');
    expect(receivables[1].outstandingAmountCents).toBe(15_000);
    expect(receivables[2].reconciliationStatus).toBe('refunded');
    expect(receivables[2].outstandingAmountCents).toBe(0);
  });

  it('gera faturamento, caixa, inadimplência e repasses', () => {
    const report = generateFinancialReports(
      ledger,
      {
        organizationId: 'org-1',
        startDate: '2026-07-01T00:00:00.000Z',
        endDate: '2026-07-31T23:59:59.999Z',
      },
      '2026-07-30T12:00:00.000Z'
    );

    expect(report.summary).toMatchObject({
      grossBilledCents: 60_000,
      discountsCents: 5_000,
      netBilledCents: 55_000,
      receivedCents: 40_000,
      refundsCents: 10_000,
      feesCents: 1_000,
      transfersPaidCents: 15_000,
      netCashCents: 14_000,
      outstandingCents: 15_000,
      overdueCents: 15_000,
      overdueChargeCount: 1,
    });
    expect(report.cashFlow.entries).toHaveLength(6);
    expect(report.transfers.paidCents).toBe(15_000);
  });

  it('filtra por paciente, profissional, método e status derivado', () => {
    const report = generateFinancialReports(
      ledger,
      {
        organizationId: 'org-1',
        patientIds: ['patient-2'],
        professionalIds: ['professional-1'],
        paymentMethods: ['cash'],
        chargeStatuses: ['overdue'],
      },
      '2026-07-30T12:00:00.000Z'
    );

    expect(report.receivables).toHaveLength(1);
    expect(report.receivables[0].chargeId).toBe('charge-2');
    expect(report.summary.overdueCents).toBe(15_000);
    expect(report.cashFlow.inflowCents).toBe(5_000);
  });

  it('exporta CSV compatível com Excel e um PDF válido', () => {
    const report = generateFinancialReports(
      ledger,
      {},
      '2026-07-30T12:00:00.000Z'
    );
    const csv = exportFinancialReportCsv(report);
    const pdf = exportFinancialReportPdf(report);
    const pdfText = new TextDecoder().decode(pdf);

    expect(csv.startsWith('\uFEFFRELATÓRIO FINANCEIRO')).toBe(true);
    expect(csv).toContain('CONTAS A RECEBER');
    expect(csv).toContain('550,00');
    expect(pdfText.startsWith('%PDF-1.4')).toBe(true);
    expect(pdfText).toContain('%%EOF');
    expect(pdf.length).toBeGreaterThan(1_000);
  });

  it('não permite dados identificáveis do paciente na auditoria', () => {
    expect(() =>
      createFinancialAuditEvent({
        id: 'audit-1',
        organizationId: 'org-1',
        actorId: 'user-1',
        action: 'report.exported',
        entityType: 'financial_report',
        entityId: 'report-1',
        occurredAt: '2026-07-30T12:00:00.000Z',
        metadata: { patientName: 'Nome completo' },
      })
    ).toThrow('Metadado sensível');
  });

  it('oferece persistência em memória isolada para desenvolvimento e testes', async () => {
    const repository = new InMemoryFinancialRepository(ledger);
    const result = await repository.getLedger({
      organizationId: 'org-1',
      patientIds: ['patient-2'],
    });

    expect(result.charges).toHaveLength(1);
    result.charges[0].amountCents = 1;
    expect(repository.snapshot().charges[1].amountCents).toBe(20_000);
  });
});
