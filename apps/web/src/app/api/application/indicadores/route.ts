import { resolveRequestContext } from '@/server/application/context';
import { failure, success } from '@/server/application/http';
import { getMonthlyIndicators } from '@/server/application/monthlyIndicators';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  try {
    const context = await resolveRequestContext(request);
    const competencia = new URL(request.url).searchParams.get('competencia');
    return success(await getMonthlyIndicators(context, competencia));
  } catch (error) {
    return failure(error);
  }
}
