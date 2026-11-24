import { resolveRequestContext } from '@/server/application/context';
import { failure, success } from '@/server/application/http';
import { listFormerTimelinePatients } from '@/server/application/timelineService';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * Pacientes que o psicólogo não atende mais, mas cujo prontuário ele
 * registrou (especificação final, § 8.05). A Gestão não tem acesso clínico.
 */
export async function GET(request: Request) {
  try {
    const context = await resolveRequestContext(request);
    if (!context.actor.roles.includes('professional')) {
      throw new Error('Acesso negado: o perfil de administrador não possui acesso aos prontuários clínicos dos pacientes.');
    }
    return success(await listFormerTimelinePatients(context));
  } catch (error) {
    return failure(error);
  }
}
