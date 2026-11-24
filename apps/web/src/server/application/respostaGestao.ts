import { NextResponse } from 'next/server';
import { NaoAutorizadoError } from '@/server/viverMaisGestaoAuth';
import { ApplicationError } from './http';

/**
 * Resposta de erro das rotas da Gestão, no formato `{ success, error }` que o
 * cockpit já lê. Migration pendente vira 503 com a causa — é o operador quem
 * precisa ler, e "falha ao salvar" não diz o que fazer.
 */
export function falhaGestao(error: unknown, contexto: string, padrao: string) {
  if (error instanceof ApplicationError) {
    return NextResponse.json({ success: false, code: error.code, error: error.message }, { status: error.status });
  }
  if (error instanceof NaoAutorizadoError) {
    return NextResponse.json({ success: false, error: error.message }, { status: error.status });
  }
  if (error instanceof Error && error.message.includes('requer a migration')) {
    return NextResponse.json({ success: false, error: error.message }, { status: 503 });
  }
  console.error(`[gestao] ${contexto}:`, error);
  return NextResponse.json({ success: false, error: padrao }, { status: 500 });
}
