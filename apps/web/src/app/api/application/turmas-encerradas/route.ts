import { NextResponse } from 'next/server';
import { readSession } from '@/server/auth';
import { exigirGestao, NaoAutorizadoError } from '@/server/viverMaisGestaoAuth';
import {
  getTurmasEncerradasRepository,
  MigracaoTurmasPendenteError,
} from '@/server/persistence/turmasEncerradas';
import {
  normalizarIdentidadeTurma,
  TURMAS_ATIVAS,
  type IdentidadeTurma,
} from '@/lib/turmaEncerrada';
import { POS_GRADUACOES_VIVER_MAIS } from '@/components/forms/opcoesPsicologo';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

class PedidoInvalidoError extends Error {
  readonly status = 400;
}

function identidadeDoPedido(turmaValor: unknown, posGraduacaoValor: unknown): IdentidadeTurma {
  const identidade = normalizarIdentidadeTurma({
    turma: typeof turmaValor === 'string' ? turmaValor : '',
    posGraduacao: typeof posGraduacaoValor === 'string' ? posGraduacaoValor : '',
  });
  if (!TURMAS_ATIVAS.includes(identidade.turma)) {
    throw new PedidoInvalidoError(`Turma inválida. Turmas ativas: ${TURMAS_ATIVAS.join(', ')}.`);
  }
  if (!POS_GRADUACOES_VIVER_MAIS.includes(identidade.posGraduacao)) {
    throw new PedidoInvalidoError('Pós-graduação inválida. Corrija o cadastro antes de administrar esta turma.');
  }
  return identidade;
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
    const identidade = identidadeDoPedido(corpo.turma, corpo.posGraduacao);
    const sessao = await readSession();
    await getTurmasEncerradasRepository().encerrar(identidade, sessao?.userId);
    return NextResponse.json({ success: true });
  } catch (error) {
    return tratarErro(error, 'Erro ao encerrar turma:');
  }
}

/** Reabre a turma: os psicólogos dela voltam ao rodízio e à vitrine. */
export async function DELETE(request: Request) {
  try {
    await exigirGestao();
    const params = new URL(request.url).searchParams;
    const identidade = identidadeDoPedido(params.get('turma'), params.get('posGraduacao'));
    await getTurmasEncerradasRepository().reabrir(identidade);
    return NextResponse.json({ success: true });
  } catch (error) {
    return tratarErro(error, 'Erro ao reabrir turma:');
  }
}
