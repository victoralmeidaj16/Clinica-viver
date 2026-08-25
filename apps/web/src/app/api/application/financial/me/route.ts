import { resolveRequestContext } from '@/server/application/context';
import { getMyFinancialData } from '@/server/application/financialService';
import { failure, success } from '@/server/application/http';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

function dateBoundary(value: string | null, end: boolean): string | undefined {
  if (!value) return undefined;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return value;
  return `${value}T${end ? '23:59:59.999' : '00:00:00.000'}-03:00`;
}

export async function GET(request: Request) {
  try {
    const context = await resolveRequestContext(request);
    const { searchParams } = new URL(request.url);
    // O recorte pelo perfil profissional é feito dentro de `getMyFinancialData`,
    // que também recusa o acesso sem vínculo profissional.
    const financial = await getMyFinancialData(context, {
      startDate: dateBoundary(searchParams.get('startDate'), false),
      endDate: dateBoundary(searchParams.get('endDate'), true),
    });
    return success(financial);
  } catch (error) {
    return failure(error);
  }
}
