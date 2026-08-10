import { generateFinancialReports } from '@thats-life/core';
import { resolveRequestContext } from '@/server/application/context';
import { failure, success } from '@/server/application/http';
import { getApplicationStore } from '@/server/application/store';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  try {
    const context = await resolveRequestContext(request);
    const store = getApplicationStore();

    const [appointments, ledger, dueNotifications] = await Promise.all([
      store.appointments.list({ organizationId: context.actor.organizationId }),
      store.financial.getLedger({ organizationId: context.actor.organizationId }),
      store.notifications.listDue(new Date().toISOString(), 100),
    ]);

    const financial = generateFinancialReports(
      ledger,
      { organizationId: context.actor.organizationId },
      new Date().toISOString()
    );

    return success({
      agenda: {
        appointments: appointments.length,
        confirmed: appointments.filter((item) => item.status === 'confirmed').length,
      },
      financial: financial.summary,
      communication: { dueNotifications: dueNotifications.length },
    });
  } catch (error) {
    return failure(error);
  }
}
