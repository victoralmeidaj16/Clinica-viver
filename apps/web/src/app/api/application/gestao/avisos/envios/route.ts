import { NextResponse } from 'next/server';
import { exigirGestaoComAutor } from '@/server/application/autorGestao';
import { falhaGestao } from '@/server/application/respostaGestao';
import { listarEnviosDeAvisos, registroDeEnviosDisponivel } from '@/server/communication/avisosEnviosRepository';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

function data(valor: string | null, fimDoDia = false): Date | undefined {
  if (!valor || !/^\d{4}-\d{2}-\d{2}$/.test(valor)) return undefined;
  const parsed = new Date(`${valor}T${fimDoDia ? '23:59:59.999' : '00:00:00.000'}-03:00`);
  return Number.isNaN(parsed.getTime()) ? undefined : parsed;
}

/** Registro de envios: destino (final), momento, retorno da integração e versão do modelo (12.04). */
export async function GET(request: Request) {
  try {
    await exigirGestaoComAutor();
    const params = new URL(request.url).searchParams;
    const envios = await listarEnviosDeAvisos({
      apenasNaoEntregues: params.get('situacao') === 'nao_entregues',
      finalidade: params.get('finalidade') || undefined,
      desde: data(params.get('desde')),
      ate: data(params.get('ate'), true),
      limite: 300,
    });
    return NextResponse.json(
      { success: true, data: { envios, disponivel: await registroDeEnviosDisponivel() } },
      { headers: { 'Cache-Control': 'no-store' } }
    );
  } catch (error) {
    return falhaGestao(error, 'Erro ao listar envios', 'Falha ao carregar o registro de envios.');
  }
}
