import { NextResponse } from 'next/server';
import { exigirVarreduraAutorizada, NaoAutorizadoError } from '@/server/viverMaisGestaoAuth';
import { liberarAvisosAguardando } from '@/server/scheduling/agendaAvisosPendentes';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * Envia as confirmações de agendamento que esperavam o horário comercial.
 *
 * Chamada pelo worker da varredura de SLA, com o mesmo `x-sla-token`: é o
 * mesmo relógio, e um segredo a mais seria mais um worker parado por variável
 * ausente. Fora do expediente, não faz nada.
 */
export async function POST(request: Request) {
  try {
    await exigirVarreduraAutorizada(request);
    return NextResponse.json({ success: true, ...(await liberarAvisosAguardando()) });
  } catch (error) {
    if (error instanceof NaoAutorizadoError) {
      return NextResponse.json({ success: false, error: error.message }, { status: error.status });
    }
    console.error('[agenda] Falha ao liberar avisos adiados:', error);
    return NextResponse.json({ success: false, error: 'Falha ao liberar avisos.' }, { status: 500 });
  }
}
