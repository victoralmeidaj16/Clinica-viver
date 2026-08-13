import {
  assertStaffAuthorized,
  exportFinancialReportCsv,
  generateFinancialReports,
  type FinancialFilter,
} from '@thats-life/core';
import type { RequestContext } from './context';
import { getApplicationStore } from './store';

export async function getFinancialReportsData(
  context: RequestContext,
  filter: FinancialFilter = {}
) {
  const store = getApplicationStore();
  const { organizationId } = context.actor;

  assertStaffAuthorized(context.actor, 'billing.read', { organizationId });

  const ledger = await store.financial.getLedger({ organizationId, ...filter });
  const reportBundle = generateFinancialReports(
    ledger,
    {
      organizationId,
      startDate: filter.startDate,
      endDate: filter.endDate,
    },
    new Date().toISOString()
  );

  return reportBundle;
}

export async function getMyFinancialData(
  context: RequestContext,
  filter: FinancialFilter = {}
) {
  const professionalId = context.actor.professionalProfileId;
  if (!professionalId) {
    throw new Error('Perfil profissional não encontrado para este acesso.');
  }
  const store = getApplicationStore();
  const organizationId = context.actor.organizationId;
  // `billing.read` abre o razão inteiro e não pertence ao papel profissional.
  // Aqui o recorte pelo perfil é obrigatório antes da leitura.
  assertStaffAuthorized(context.actor, 'organization.read', { organizationId });
  const ledger = await store.financial.getLedger({
    organizationId,
    professionalIds: [professionalId],
  });
  const patients = await store.identities.listPatients(organizationId);
  const names = new Map(patients.map((patient) => [patient.id, patient.displayName]));
  const charges = new Map(ledger.charges.map((charge) => [charge.id, charge]));
  const transactions = ledger.payments
    .filter((payment) => payment.status === 'confirmed')
    .filter((payment) => !filter.startDate || Date.parse(payment.receivedAt) >= Date.parse(filter.startDate))
    .filter((payment) => !filter.endDate || Date.parse(payment.receivedAt) <= Date.parse(filter.endDate))
    .map((payment) => {
      const charge = charges.get(payment.chargeId);
      return {
        id: payment.id,
        patientName: charge ? names.get(charge.patientId) ?? 'Paciente' : 'Paciente',
        receivedAt: payment.receivedAt,
        amountCents: payment.amountCents,
        professionalCreditCents: Math.round(payment.amountCents * 0.7),
        clinicRevenueCents: payment.amountCents - Math.round(payment.amountCents * 0.7),
        method: payment.method,
      };
    })
    .sort((left, right) => right.receivedAt.localeCompare(left.receivedAt));
  return {
    professionalId,
    receivedCents: transactions.reduce((sum, item) => sum + item.amountCents, 0),
    professionalCreditCents: transactions.reduce(
      (sum, item) => sum + item.professionalCreditCents, 0
    ),
    transactions,
  };
}

export async function exportFinancialCsvData(
  context: RequestContext,
  filter: FinancialFilter = {}
): Promise<string> {
  const reportBundle = await getFinancialReportsData(context, filter);
  return exportFinancialReportCsv(reportBundle);
}
