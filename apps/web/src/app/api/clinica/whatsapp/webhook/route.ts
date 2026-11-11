import { NextResponse } from 'next/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * Webhook da Evolution API.
 *
 * O psicólogo decide sobre um paciente novo somente pelo link da mensagem de
 * alocação (confirmar ou encaminhar). Texto recebido no WhatsApp da clínica não
 * é interpretado nem respondido: saudação automática do WhatsApp Business,
 * mensagem de ausência ou conversa comum não podem virar comando nem disparar
 * resposta de robô.
 *
 * A rota continua existindo e responde `200` para a Evolution não reentregar o
 * mesmo evento em laço.
 */

function autorizado(request: Request): boolean {
  const esperado = process.env.EVOLUTION_WEBHOOK_TOKEN?.trim();
  // Falha fechada: sem token configurado a rota não aceita nada.
  if (!esperado) return false;

  const recebido =
    request.headers.get('x-evolution-token')?.trim() ||
    request.headers.get('apikey')?.trim() ||
    new URL(request.url).searchParams.get('token')?.trim() ||
    '';
  return recebido.length === esperado.length && recebido === esperado;
}

export async function POST(request: Request) {
  if (!autorizado(request)) {
    return NextResponse.json({ success: false, error: 'Token inválido.' }, { status: 401 });
  }
  return NextResponse.json({ success: true, ignorado: 'decisao_somente_pelo_link' });
}
