import { resolveRequestContext } from '@/server/application/context';
import { failure, success } from '@/server/application/http';
import { getClinicalTimeline } from '@/server/application/timelineService';
import type { ClinicalTimelineCategory } from '@thats-life/core';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  try {
    const context = await resolveRequestContext(request);
    const { searchParams } = new URL(request.url);

    const patientId = searchParams.get('patientId') || 'patient-1';
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
