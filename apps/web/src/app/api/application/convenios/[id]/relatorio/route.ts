import { resolveRequestContext } from '@/server/application/context';
import { convenioReport } from '@/server/application/convenioService';
import { failure } from '@/server/application/http';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const url = new URL(request.url);
    const format = url.searchParams.get('format') === 'pdf' ? 'pdf' : 'csv';
    const report = await convenioReport(await resolveRequestContext(request), decodeURIComponent(id), {
      inicio: url.searchParams.get('inicio') ?? undefined, fim: url.searchParams.get('fim') ?? undefined, format,
    });
    return new Response(typeof report.body === 'string' ? report.body : new Uint8Array(report.body), { headers: {
      'Content-Type': report.contentType,
      'Content-Disposition': `attachment; filename="${report.filename}"`,
      'Cache-Control': 'private, no-store',
    } });
  } catch (error) { return failure(error); }
}
