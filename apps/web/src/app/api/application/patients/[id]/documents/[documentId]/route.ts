import { resolveRequestContext } from '@/server/application/context';
import { failure, success } from '@/server/application/http';
import { documentService } from '@/server/documents/documentService';
import { psychologicalDocumentPdf } from '@/server/documents/documentPdf';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(request: Request, route: { params: Promise<{ id: string; documentId: string }> }) {
  try {
    const context = await resolveRequestContext(request);
    const { id, documentId } = await route.params;
    const document = await documentService.get(context, id, documentId);
    if (new URL(request.url).searchParams.get('format') !== 'pdf') return success(document);
    const pdf = await psychologicalDocumentPdf(document);
    return new Response(new Uint8Array(pdf), { headers: {
      'Content-Type': 'application/pdf', 'Content-Disposition': `attachment; filename="documento-${document.id.slice(0, 12)}.pdf"`,
      'Cache-Control': 'private, no-store', 'X-Content-Type-Options': 'nosniff',
    } });
  } catch (error) { return failure(error); }
}
