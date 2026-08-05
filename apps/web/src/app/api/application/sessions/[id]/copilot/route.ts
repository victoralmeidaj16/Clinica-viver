import { assertStaffAuthorized } from '@thats-life/core';
import { resolveRequestContext } from '@/server/application/context';
import { ApplicationError, failure, readJson, success } from '@/server/application/http';
import { getApplicationStore } from '@/server/application/store';
import { generateCopilotSuggestion, isCopilotAction } from '@/server/ai/copilot';
import { pseudonymizePatient } from '@/server/ai/pseudonym';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * Sugestão do copiloto para a sessão em andamento.
 *
 * Exige vínculo do profissional com o paciente: o copiloto lê a transcrição
 * parcial, que é conteúdo clínico. A sugestão não é persistida — é material de
 * apoio efêmero, e nada aqui toca o prontuário.
 */
export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const context = await resolveRequestContext(request);
    const { id: sessionId } = await params;
    const body = await readJson(request);

    if (!isCopilotAction(body.action)) {
      throw new ApplicationError(
        'INVALID_ACTION',
        'A ação do copiloto deve ser summary, risk, hypothesis ou intervention.',
        400
      );
    }

    const elapsedSeconds =
      typeof body.elapsedSeconds === 'number' && Number.isFinite(body.elapsedSeconds)
        ? Math.max(0, Math.floor(body.elapsedSeconds))
        : 0;

    const store = getApplicationStore();
    const session = await store.sessions.getById(context.actor.organizationId, sessionId);
    const patientId = session?.patientId ?? 'patient-1';

    assertStaffAuthorized(context.actor, 'clinical_records.read', {
      organizationId: context.actor.organizationId,
      patientId,
      assignedProfessionalIds: session?.assignedProfessionalIds,
    });

    const suggestion = await generateCopilotSuggestion({
      patientId,
      patientReference: pseudonymizePatient({
        organizationId: context.actor.organizationId,
        patientId,
      }),
      action: body.action,
      elapsedSeconds,
    });

    return success(suggestion);
  } catch (err) {
    return failure(err);
  }
}
