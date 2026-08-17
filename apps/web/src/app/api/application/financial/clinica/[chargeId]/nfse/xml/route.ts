import { resolveRequestContext } from '@/server/application/context';
import { failure } from '@/server/application/http';
import { xmlDaEmissaoNfse, type TipoXmlFiscal } from '@/server/application/nfseEmissionService';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * Baixa o XML do documento fiscal.
 *
 * `?tipo=nfse` (padrão) devolve a nota que a SEFIN emitiu; `?tipo=dps` devolve a
 * declaração assinada que a originou, que é o que se examina quando a nota é
 * rejeitada e não existe NFS-e nenhuma para baixar.
 *
 * Sai como anexo, e não como JSON: o arquivo é o que o contador arquiva.
 */
export async function GET(
  request: Request,
  { params }: { params: Promise<{ chargeId: string }> }
) {
  try {
    const context = await resolveRequestContext(request);
    const { chargeId } = await params;
    const tipo: TipoXmlFiscal = new URL(request.url).searchParams.get('tipo') === 'dps' ? 'dps' : 'nfse';
    const documento = await xmlDaEmissaoNfse(context, decodeURIComponent(chargeId), tipo);

    return new Response(documento.xml, {
      headers: {
        'Content-Type': 'application/xml; charset=utf-8',
        'Content-Disposition': `attachment; filename="${documento.nomeArquivo}"`,
        'Cache-Control': 'no-store',
      },
    });
  } catch (error) {
    return failure(error);
  }
}
