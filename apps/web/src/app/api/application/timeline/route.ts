import { resolveRequestContext } from '@/server/application/context';
import { failure, readJson, success } from '@/server/application/http';
import {
  createManualClinicalRecord,
  getClinicalTimeline,
} from '@/server/application/timelineService';
import { parseManualClinicalRecordInput } from '@/server/application/manualClinicalRecordInput';
import type { ClinicalTimelineCategory } from '@thats-life/core';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  try {
    const context = await resolveRequestContext(request);

    // Conforme o CFP e a LGPD, administradores não possuem acesso a prontuários clínicos.
    // Apenas psicólogos (papel profissional) acessam prontuários dos seus pacientes atribuídos.
    if (!context.actor.roles.includes('professional')) {
      throw new Error('Acesso negado: O perfil de administrador não possui acesso aos prontuários clínicos dos pacientes.');
    }

    const { searchParams } = new URL(request.url);

    const patientId = searchParams.get('patientId');
    if (!patientId) {
      throw new Error('Selecione um paciente para consultar a linha do tempo.');
    }
    const query = searchParams.get('query') || undefined;
    const categoriesParam = searchParams.get('categories');

    const categories = categoriesParam
      ? (categoriesParam.split(',') as ClinicalTimelineCategory[])
      : undefined;

    const occurredFrom = searchParams.get('occurredFrom') || undefined;
    const occurredUntil = searchParams.get('occurredUntil') || undefined;

    const result = await getClinicalTimeline(context, {
      patientId,
      query,
      categories,
      occurredFrom,
      occurredUntil,
    });

    return success(result);
  } catch (error) {
    return failure(error);
  }
}

export async function POST(request: Request) {
  try {
    const context = await resolveRequestContext(request, true);
    const input = parseManualClinicalRecordInput(await readJson(request));
    return success(await createManualClinicalRecord(context, input), 201);
  } catch (error) {
    return failure(error);
  }
}
