import { resolveRequestContext } from '@/server/application/context';
import { failure, readJson, success } from '@/server/application/http';
import { getPatientBond, updatePatientBond } from '@/server/application/patientBond';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/** Responsável financeiro e participantes do vínculo (6.03 e 6.04). */
export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const context = await resolveRequestContext(request);
    const { id } = await params;
    return success(await getPatientBond(context, decodeURIComponent(id)));
  } catch (error) {
    return failure(error);
  }
}

export async function PUT(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const context = await resolveRequestContext(request, true);
    const { id } = await params;
    return success(await updatePatientBond(context, decodeURIComponent(id), await readJson(request)));
  } catch (error) {
    return failure(error);
  }
}
