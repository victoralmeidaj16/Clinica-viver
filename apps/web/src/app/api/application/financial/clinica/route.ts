import { NextResponse } from 'next/server';
import { resolveRequestContext } from '@/server/application/context';
import { failure, success } from '@/server/application/http';
import {
  exportClinicFinanceCsv,
  getClinicFinanceOverview,
} from '@/server/application/clinicFinanceService';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * O filtro chega da tela como `AAAA-MM-DD`, que `Date.parse` lê como meia-noite
 * UTC — e às 21h de Brasília do dia 31 a cobrança já caiu no dia seguinte em
 * UTC, ficando de fora do próprio mês. Ancorar as bordas em -03:00 devolve ao
 * período o dia que a clínica realmente viveu. O Brasil não tem mais horário de
 * verão, então o deslocamento é constante.
 */
function inicioDoDia(valor: string | null): string | undefined {
  if (!valor) return undefined;
  return /^\d{4}-\d{2}-\d{2}$/.test(valor) ? `${valor}T00:00:00.000-03:00` : valor;
}

function fimDoDia(valor: string | null): string | undefined {
  if (!valor) return undefined;
  return /^\d{4}-\d{2}-\d{2}$/.test(valor) ? `${valor}T23:59:59.999-03:00` : valor;
}

export async function GET(request: Request) {
  try {
    const context = await resolveRequestContext(request);
    const { searchParams } = new URL(request.url);

    const filter = {
      startDate: inicioDoDia(searchParams.get('startDate')),
      endDate: fimDoDia(searchParams.get('endDate')),
    };

    if (searchParams.get('format') === 'csv') {
      const csv = await exportClinicFinanceCsv(context, filter);
      return new NextResponse(csv, {
        status: 200,
        headers: {
          'Content-Type': 'text/csv; charset=utf-8',
          'Content-Disposition': 'attachment; filename="financeiro-clinica.csv"',
          'Cache-Control': 'no-store',
        },
      });
    }

    return success(await getClinicFinanceOverview(context, filter));
  } catch (error) {
    return failure(error);
  }
}
