import { resolveRequestContext } from '@/server/application/context';
import { failure } from '@/server/application/http';
import { pdfDaEmissaoNfse } from '@/server/application/nfseEmissionService';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/** Visualiza ou baixa o DANFSe gerado a partir do XML oficial armazenado. */
export async function GET(
  request: Request,
  { params }: { params: Promise<{ chargeId: string }> }
) {
  try {
    const context = await resolveRequestContext(request);
    const { chargeId } = await params;
    const documento = await pdfDaEmissaoNfse(context, decodeURIComponent(chargeId));
    const disposition = new URL(request.url).searchParams.get('download') === '1'
      ? 'attachment'
      : 'inline';

    return new Response(new Uint8Array(documento.pdf), {
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `${disposition}; filename="${documento.nomeArquivo}"`,
        'Cache-Control': 'private, no-store',
        'X-Content-Type-Options': 'nosniff',
      },
    });
  } catch (error) {
    return failure(error);
  }
}
