import { NextResponse } from 'next/server';
import { normalizarCodigoVerificacao } from '@thats-life/core';
import { rateLimited } from '@/server/http/publicRequest';
import { conferirDeclaracao } from '@/server/application/declaracaoHorasService';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * Conferência pública de uma declaração de horas.
 *
 * É aberta de propósito: quem confere é a coordenação do curso, que não tem —
 * e não deve ter — conta na clínica. O código impresso é a credencial, e o
 * documento em papel já traz tudo que esta resposta devolve.
 *
 * O balde por origem existe porque um endereço público que responde "existe" ou
 * "não existe" é um oráculo: sem freio, dá para varrer o espaço de códigos até
 * encontrar declarações alheias. Oito caracteres tornam a varredura inviável;
 * o limite garante que ela nem comece.
 */
export async function GET(request: Request, { params }: { params: Promise<{ codigo: string }> }) {
  const { codigo } = await params;

  if (rateLimited(request, 'declaracao-validar', { limite: 20, janelaMs: 10 * 60_000 })) {
    return NextResponse.json(
      { ok: false, error: { code: 'RATE_LIMITED', message: 'Muitas consultas deste acesso. Aguarde alguns minutos.' } },
      { status: 429, headers: { 'Retry-After': '600', 'Cache-Control': 'no-store' } }
    );
  }

  // Um código malformado nunca chega ao banco: normalizar antes evita que erro
  // de digitação vire consulta, e mantém a resposta igual à de código inexistente.
  const normalizado = normalizarCodigoVerificacao(codigo ?? '');
  if (!normalizado) {
    return NextResponse.json(
      { ok: false, error: { code: 'NOT_FOUND', message: 'Código de conferência inválido.' } },
      { status: 404, headers: { 'Cache-Control': 'no-store' } }
    );
  }

  try {
    const resultado = await conferirDeclaracao(normalizado);
    if (!resultado) {
      return NextResponse.json(
        { ok: false, error: { code: 'NOT_FOUND', message: 'Nenhuma declaração foi emitida com este código.' } },
        { status: 404, headers: { 'Cache-Control': 'no-store' } }
      );
    }

    return NextResponse.json(
      { ok: true, data: resultado },
      { status: 200, headers: { 'Cache-Control': 'no-store' } }
    );
  } catch (erro) {
    console.error('[declaracao] Falha ao conferir declaração:', erro);
    return NextResponse.json(
      { ok: false, error: { code: 'INTERNAL', message: 'Não foi possível conferir a declaração agora.' } },
      { status: 500, headers: { 'Cache-Control': 'no-store' } }
    );
  }
}
