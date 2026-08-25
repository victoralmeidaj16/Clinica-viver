import { resolveRequestContext } from '@/server/application/context';
import { failure } from '@/server/application/http';
import { xmlDaEmissaoNfse, type TipoXmlFiscal } from '@/server/application/nfseEmissionService';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(request: Request, { params }: { params: Promise<{ faturaId: string }> }) {
  try {
    const { faturaId } = await params;
    const tipo: TipoXmlFiscal = new URL(request.url).searchParams.get('tipo') === 'dps' ? 'dps' : 'nfse';
    const document = await xmlDaEmissaoNfse(await resolveRequestContext(request), decodeURIComponent(faturaId), tipo);
    return new Response(document.xml, { headers: {
      'Content-Type': 'application/xml; charset=utf-8',
      'Content-Disposition': `attachment; filename="${document.nomeArquivo}"`,
      'Cache-Control': 'no-store',
    } });
  } catch (error) { return failure(error); }
}
