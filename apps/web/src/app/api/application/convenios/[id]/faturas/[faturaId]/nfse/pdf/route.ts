import { resolveRequestContext } from '@/server/application/context';
import { failure } from '@/server/application/http';
import { pdfDaEmissaoNfse } from '@/server/application/nfseEmissionService';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(request: Request, { params }: { params: Promise<{ faturaId: string }> }) {
  try {
    const { faturaId } = await params;
    const document = await pdfDaEmissaoNfse(await resolveRequestContext(request), decodeURIComponent(faturaId));
    return new Response(new Uint8Array(document.pdf), { headers: {
      'Content-Type': 'application/pdf',
      'Content-Disposition': `inline; filename="${document.nomeArquivo}"`,
      'Cache-Control': 'private, no-store',
    } });
  } catch (error) { return failure(error); }
}
