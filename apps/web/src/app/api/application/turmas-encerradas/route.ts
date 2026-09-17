import { NextResponse } from 'next/server';
import { readSession } from '@/server/auth';
import { exigirGestao, NaoAutorizadoError } from '@/server/viverMaisGestaoAuth';
import {
  getTurmasEncerradasRepository,
  MigracaoTurmasPendenteError,
} from '@/server/persistence/turmasEncerradas';
import { TURMAS_ATIVAS } from '@/lib/turmaEncerrada';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

class PedidoInvalidoError extends Error {
  readonly status = 400;
}

function turmaDoPedido(valor: unknown): string {
  const turma = typeof valor === 'string' ? valor.trim().toUpperCase() : '';
  if (!TURMAS_ATIVAS.includes(turma)) {
    throw new PedidoInvalidoError(`Turma inválida. Turmas ativas: ${TURMAS_ATIVAS.join(', ')}.`);
  }
  return turma;
}

function tratarErro(error: unknown, contexto: string) {
  if (
    error instanceof NaoAutorizadoError ||
    error instanceof PedidoInvalidoError ||
    error instanceof MigracaoTurmasPendenteError
  ) {
    return NextResponse.json({ success: false, error: error.message }, { status: error.status });
  }
  console.error(contexto, error);
  return NextResponse.json({ success: false, error: 'Falha ao atualizar as turmas.' }, { status: 500 });
}

export async function GET() {
  try {
    await exigirGestao();
    const data = await getTurmasEncerradasRepository().listar();
    return NextResponse.json({ success: true, data }, { headers: { 'Cache-Control': 'no-store' } });
  } catch (error) {
    return tratarErro(error, 'Erro ao listar turmas encerradas:');
  }
}

/** Encerra a turma: os psicólogos dela saem do rodízio e da vitrine. */
export async function POST(request: Request) {
  try {
    await exigirGestao();
    const corpo = (await request.json().catch(() => ({}))) as Record<string, unknown>;
    const turma = turmaDoPedido(corpo.turma);
    const sessao = await readSession();
    await getTurmasEncerradasRepository().encerrar(turma, sessao?.userId);
    return NextResponse.json({ success: true });
  } catch (error) {
    return tratarErro(error, 'Erro ao encerrar turma:');
  }
}

/** Reabre a turma: os psicólogos dela voltam ao rodízio e à vitrine. */
export async function DELETE(request: Request) {
  try {
    await exigirGestao();
    const turma = turmaDoPedido(new URL(request.url).searchParams.get('turma'));
    await getTurmasEncerradasRepository().reabrir(turma);
    return NextResponse.json({ success: true });
  } catch (error) {
    return tratarErro(error, 'Erro ao reabrir turma:');
  }
}
