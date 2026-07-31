import { resolveRequestContext } from '@/server/application/context';
import { failure, success } from '@/server/application/http';
import { getApplicationStore } from '@/server/application/store';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  try {
    const context = await resolveRequestContext(request); const store = getApplicationStore();
    const [appointments, dueNotifications] = await Promise.all([store.appointments.list({ organizationId: context.actor.organizationId }), store.notifications.listDue(new Date().toISOString(), 100)]);
    return success({ organizationId: context.actor.organizationId, userId: context.actor.userId, modules: { identity: 'ready', scheduling: 'ready', communication: 'ready', clinicalSession: 'core_ready', clinicalRecord: 'core_ready', carePlan: 'core_ready', financial: 'core_ready' }, counts: { appointments: appointments.length, dueNotifications: dueNotifications.length } });
  } catch (error) { return failure(error); }
}
