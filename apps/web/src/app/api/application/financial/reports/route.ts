import { NextResponse } from 'next/server';
import { resolveRequestContext } from '@/server/application/context';
import { failure, success } from '@/server/application/http';
import {
  exportFinancialCsvData,
  getFinancialReportsData,
} from '@/server/application/financialService';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  try {
    const context = await resolveRequestContext(request);
    const { searchParams } = new URL(request.url);

    const format = searchParams.get('format') || 'json';
    const startDate = searchParams.get('startDate') || undefined;
    const endDate = searchParams.get('endDate') || undefined;

    const filter = { startDate, endDate };

    if (format === 'csv') {
      const csvContent = await exportFinancialCsvData(context, filter);
      return new NextResponse(csvContent, {
        status: 200,
        headers: {
          'Content-Type': 'text/csv; charset=utf-8',
          'Content-Disposition': 'attachment; filename="relatorio-financeiro.csv"',
          'Cache-Control': 'no-store',
        },
      });
    }

    const reportBundle = await getFinancialReportsData(context, filter);
    return success(reportBundle);
  } catch (error) {
    return failure(error);
  }
}
