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

  const ledger = await store.financial.getLedger({ organizationId });
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

export async function exportFinancialCsvData(
  context: RequestContext,
  filter: FinancialFilter = {}
): Promise<string> {
  const reportBundle = await getFinancialReportsData(context, filter);
  return exportFinancialReportCsv(reportBundle);
}
