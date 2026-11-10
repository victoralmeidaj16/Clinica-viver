import { resolveRequestContext } from '@/server/application/context';
import { failure, readJson, success } from '@/server/application/http';
import { updateClinicChargeDue } from '@/server/application/clinicChargeDueService';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function PATCH(request: Request, { params }: { params: Promise<{ chargeId: string }> }) {
  try {
    const context = await resolveRequestContext(request);
    const { chargeId } = await params;
    return success(await updateClinicChargeDue(context, chargeId, await readJson(request)));
  } catch (error) {
    return failure(error);
  }
}
