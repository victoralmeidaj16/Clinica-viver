import { exigirGestao, NaoAutorizadoError } from '@/server/viverMaisGestaoAuth';
import { ApplicationError, failure, readJson, success } from '@/server/application/http';
import { updatePatientSessionPricing, validatePatientSessionPricing } from '@/server/persistence/mysql/patientSessionPricing';
import { readSession } from '@/server/auth';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function PUT(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    await exigirGestao();
    const session = await readSession();
    if (!session) throw new Error('Faça login para continuar.');
    const { id } = await params;
    const pricing = validatePatientSessionPricing(await readJson(request));
    await updatePatientSessionPricing(session.organizationId, decodeURIComponent(id), pricing);
    return success(pricing);
  } catch (error) {
    return failure(error instanceof NaoAutorizadoError
      ? new ApplicationError('FORBIDDEN', error.message, error.status)
      : error);
  }
}
