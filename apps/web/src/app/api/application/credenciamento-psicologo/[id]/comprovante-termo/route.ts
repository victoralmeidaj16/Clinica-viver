import { NextResponse } from 'next/server';
import { getCaptureRepository } from '@/server/persistence/captureRepository';
import { MysqlCaptureRepository } from '@/server/persistence/mysql/captureRepository';
import { isMysqlConfigured } from '@/server/oci/runtime';
import { exigirGestao, NaoAutorizadoError } from '@/server/viverMaisGestaoAuth';
import { montarComprovanteTermoAdesao } from '@/server/application/termoAdesaoComprovantePdf';
import { enviarComprovanteTermoAdesao } from '@/server/application/termoAdesaoComprovanteEmail';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

async function cadastroComAceite(id: string) {
  const cadastro = (await getCaptureRepository().read()).cadastrosPsicologos.find((item) => item.id === id);
  if (!cadastro) return { erro: NextResponse.json({ success: false, error: 'Cadastro não encontrado.' }, { status: 404 }) };
  if (!cadastro.aceiteTermoAdesao) {
    return {
      erro: NextResponse.json(
        { success: false, error: 'Este cadastro não tem prova de aceite registrada pelo servidor.' },
        { status: 409 }
      ),
    };
  }
  return { cadastro };
}

function falha(error: unknown, acao: string) {
  if (error instanceof NaoAutorizadoError) {
    return NextResponse.json({ success: false, error: error.message }, { status: error.status });
  }
  console.error(`Erro ao ${acao} o comprovante do Termo de Adesão:`, error);
  return NextResponse.json({ success: false, error: `Falha ao ${acao} o comprovante.` }, { status: 500 });
}

/**
 * Baixa o comprovante do aceite. O PDF é regerado a partir da prova gravada;
 * como a geração é determinística, `X-Comprovante-Confere` diz se o arquivo é
 * idêntico, byte a byte, ao que foi enviado por e-mail no credenciamento.
 */
export async function GET(_: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    await exigirGestao();
    const { cadastro, erro } = await cadastroComAceite((await params).id);
    if (erro) return erro;
    const comprovante = await montarComprovanteTermoAdesao(cadastro);
    const registrado = cadastro.aceiteTermoAdesao?.comprovante?.sha256;
    return new NextResponse(new Uint8Array(comprovante.pdf), {
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="${comprovante.arquivo}"`,
        'Cache-Control': 'no-store',
        'X-Comprovante-Sha256': comprovante.sha256,
        'X-Comprovante-Confere': registrado ? (registrado === comprovante.sha256 ? 'sim' : 'nao') : 'sem-registro',
      },
    });
  } catch (error) {
    return falha(error, 'gerar');
  }
}

/** Reenvia a via do termo ao profissional e à clínica — útil quando o primeiro envio falhou. */
export async function POST(_: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    await exigirGestao();
    const { cadastro, erro } = await cadastroComAceite((await params).id);
    if (erro) return erro;
    const comprovante = await montarComprovanteTermoAdesao(cadastro);
    const envio = await enviarComprovanteTermoAdesao(cadastro, comprovante, new Date(), `reenvio-${Date.now()}`);
    if (isMysqlConfigured()) await new MysqlCaptureRepository().registrarEnvioComprovanteTermo(cadastro.id, envio);
    const status = envio.situacao === 'enviada' ? 200 : 502;
    return NextResponse.json({ success: envio.situacao === 'enviada', data: envio }, { status });
  } catch (error) {
    return falha(error, 'reenviar');
  }
}
