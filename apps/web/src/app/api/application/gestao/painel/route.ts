import { NextResponse } from 'next/server';
import { exigirGestaoComAutor } from '@/server/application/autorGestao';
import { ApplicationError } from '@/server/application/http';
import { montarPainelIndicadores } from '@/server/application/painelIndicadores';
import { falhaGestao } from '@/server/application/respostaGestao';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const DATA = /^\d{4}-\d{2}-\d{2}$/;

function hoje(): string {
  return new Date().toLocaleDateString('en-CA', { timeZone: 'America/Sao_Paulo' });
}

/** Indicadores do painel inicial com o período de cada um (13.04). Padrão: mês corrente até hoje. */
export async function GET(request: Request) {
  try {
    const { sessao } = await exigirGestaoComAutor();
    const params = new URL(request.url).searchParams;
    const ate = params.get('ate') || hoje();
    const desde = params.get('desde') || `${ate.slice(0, 8)}01`;
    if (!DATA.test(desde) || !DATA.test(ate) || desde > ate) {
      throw new ApplicationError('INVALID_INPUT', 'Informe um período válido.', 400);
    }
    return NextResponse.json(
      { success: true, data: await montarPainelIndicadores(sessao.organizationId, { desde, ate }) },
      { headers: { 'Cache-Control': 'no-store' } }
    );
  } catch (error) {
    return falhaGestao(error, 'Erro ao montar indicadores', 'Falha ao carregar os indicadores.');
  }
}
