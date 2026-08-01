import { describe, expect, it } from 'vitest';
import {
  createFinancialCharge,
  createOrganization,
  createProfessionalProfile,
  exportFinancialReportCsv,
  generateFinancialReports,
  InMemoryFinancialRepository,
} from './index';

describe('Fluxo da Aplicação Financeira & Exportação CSV', () => {
  const organizationId = 'org-demo';
  const professionalId = 'professional-1';
  const patientId = 'patient-1';
  const createdAt = '2026-07-31T12:00:00.000Z';

  const organization = createOrganization({
    id: organizationId,
    type: 'clinic',
    displayName: 'Clínica Demo',
    timezone: 'America/Sao_Paulo',
    createdAt,
  });

  const professional = createProfessionalProfile({
    id: professionalId,
    organizationId,
    userId: 'user-demo',
    displayName: 'Dra. Camila',
    councilType: 'CRP',
    councilRegistration: '06/12345',
    specialties: ['TCC'],
    createdAt,
  });

  const charge = createFinancialCharge({
    id: 'charge-test-1',
    organizationId,
    sessionId: 'session-test-1',
    patientId,
    professionalId,
    issuedAt: '2026-07-30T12:00:00.000Z',
    dueAt: '2026-08-05T23:59:00.000Z',
    amountCents: 25000,
    createdAt,
  });

  it('gera relatório financeiro agrupado com métricas de faturamento e contas a receber', async () => {
    const repository = new InMemoryFinancialRepository({ charges: [charge] });
    const ledger = await repository.getLedger({ organizationId });

    const reportBundle = generateFinancialReports(
      ledger,
      { organizationId },
      createdAt
    );

    expect(reportBundle.summary.grossBilledCents).toBe(25000);
    expect(reportBundle.summary.chargeCount).toBe(1);
    expect(reportBundle.receivables).toHaveLength(1);
    expect(reportBundle.receivables[0].chargeId).toBe('charge-test-1');
  });

  it('exporta o relatório financeiro em formato CSV compatível com Excel em português', async () => {
    const repository = new InMemoryFinancialRepository({ charges: [charge] });
    const ledger = await repository.getLedger({ organizationId });

    const reportBundle = generateFinancialReports(
      ledger,
      { organizationId },
      createdAt
    );

    const csvContent = exportFinancialReportCsv(reportBundle);

    expect(csvContent).toContain('\uFEFFRELATÓRIO FINANCEIRO');
    expect(csvContent).toContain('Métrica;Valor');
    expect(csvContent).toContain('Faturamento bruto;250,00');
    expect(csvContent).toContain('CONTAS A RECEBER');
    expect(csvContent).toContain('charge-test-1');
  });
});
