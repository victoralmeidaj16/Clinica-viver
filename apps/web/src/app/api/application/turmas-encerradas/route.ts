import { NextResponse } from 'next/server';
import { readSession } from '@/server/auth';
import { exigirGestao, NaoAutorizadoError } from '@/server/viverMaisGestaoAuth';
import {
  getTurmasEncerradasRepository,
  MigracaoTurmasPendenteError,
} from '@/server/persistence/turmasEncerradas';
import { getTurmasRepository } from '@/server/persistence/turmasRepository';
import {
  chaveTurma,
  normalizarIdentidadeTurma,
  TURMAS_ATIVAS,
  type IdentidadeTurma,
} from '@/lib/turmaEncerrada';
import { normalizarCodigoTurma } from '@/lib/turmasCiclo';
import { cursoNoCatalogo } from '@/components/forms/opcoesPsicologo';
import { obterCatalogoCursos } from '@/server/application/catalogoCursos';
import { executarAcaoTurma, obterPainelTurmas } from '@/server/application/turmasGestao';
import { nomeDoUsuario } from '@/server/application/autorGestao';
import { ApplicationError } from '@/server/application/http';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * Rota anterior de encerramento de turmas, mantida por compatibilidade.
 *
 * Com o cadastro de turmas (migration 092), encerrar e reabrir passam pelo
 * mesmo caminho do painel "Cursos e turmas", com prazo de saída e histórico.
 * Sem ele, o encerramento é gravado na tabela antiga e segue o mesmo prazo.
 */

class PedidoInvalidoError extends Error {
  readonly status = 400;
}

async function identidadeDoPedido(turmaValor: unknown, posGraduacaoValor: unknown): Promise<IdentidadeTurma> {
  const codigo = normalizarCodigoTurma(turmaValor);
  const identidade = normalizarIdentidadeTurma({
    turma: codigo ?? '',
    posGraduacao: typeof posGraduacaoValor === 'string' ? posGraduacaoValor : '',
  });
  if (!cursoNoCatalogo(identidade.posGraduacao, await obterCatalogoCursos())) {
    throw new PedidoInvalidoError('Pós-graduação inválida. Corrija o cadastro antes de administrar esta turma.');
  }
  // Esta rota só administra turmas conhecidas: as cadastradas ou a lista anterior.
  const cadastradas = (await getTurmasRepository().listar()) ?? [];
  const conhecida = TURMAS_ATIVAS.includes(identidade.turma)
    || cadastradas.some((turma) => chaveTurma({ turma: turma.codigo, posGraduacao: turma.posGraduacao }) === chaveTurma(identidade));
  if (!codigo || !conhecida) throw new PedidoInvalidoError(`Turma inválida. Turmas conhecidas: ${TURMAS_ATIVAS.join(', ')}.`);
  return identidade;
}

function tratarErro(error: unknown, contexto: string) {
  if (
    error instanceof NaoAutorizadoError ||
    error instanceof PedidoInvalidoError ||
    error instanceof MigracaoTurmasPendenteError ||
    error instanceof ApplicationError
  ) {
    return NextResponse.json({ success: false, error: error.message }, { status: error.status });
  }
  console.error(contexto, error);
  return NextResponse.json({ success: false, error: 'Falha ao atualizar as turmas.' }, { status: 500 });
}

async function autor() {
  const sessao = await readSession();
  return { usuarioRef: sessao?.userId ?? 'gestao', nome: sessao ? await nomeDoUsuario(sessao.userId) : undefined };
}

/** Pelo cadastro de turmas: cria a turma se ainda não existir e aplica a ação. */
async function noCadastro(identidade: IdentidadeTurma, acao: 'ENCERRAR' | 'REABRIR'): Promise<boolean> {
  const turmas = await getTurmasRepository().listar();
  if (turmas === null) return false;
  const sessao = await readSession();
  const organizacao = sessao?.organizationId ?? '';
  const quem = await autor();
  let turma = turmas.find((item) => chaveTurma({ turma: item.codigo, posGraduacao: item.posGraduacao }) === chaveTurma(identidade));
  if (!turma) {
    if (acao === 'REABRIR') return true;
    turma = await executarAcaoTurma(organizacao, { acao: 'CRIAR', posGraduacao: identidade.posGraduacao, codigo: identidade.turma }, quem);
  }
  await executarAcaoTurma(organizacao, { acao, id: turma.id }, quem);
  return true;
}

export async function GET() {
  try {
    await exigirGestao();
    const sessao = await readSession();
    const painel = await obterPainelTurmas(sessao?.organizationId ?? '');
    if (painel.cadastroDisponivel) {
      const data = painel.turmas.filter((turma) => turma.encerradaEm).map((turma) => ({
        turma: turma.codigo, posGraduacao: turma.posGraduacao, encerradaEm: turma.encerradaEm!,
        ...(turma.saidaEm ? { saidaEm: turma.saidaEm } : {}),
        ...(turma.retiradaInterrompida ? { retiradaInterrompida: true } : {}),
      }));
      return NextResponse.json({ success: true, data }, { headers: { 'Cache-Control': 'no-store' } });
    }
    const data = await getTurmasEncerradasRepository().listar();
    return NextResponse.json({ success: true, data }, { headers: { 'Cache-Control': 'no-store' } });
  } catch (error) {
    return tratarErro(error, 'Erro ao listar turmas encerradas:');
  }
}

/** Encerra a turma. Com o cadastro de turmas, começa o prazo de saída. */
export async function POST(request: Request) {
  try {
    await exigirGestao();
    const corpo = (await request.json().catch(() => ({}))) as Record<string, unknown>;
    const identidade = await identidadeDoPedido(corpo.turma, corpo.posGraduacao);
    if (!(await noCadastro(identidade, 'ENCERRAR'))) {
      const sessao = await readSession();
      await getTurmasEncerradasRepository().encerrar(identidade, sessao?.userId);
    }
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
    const identidade = await identidadeDoPedido(params.get('turma'), params.get('posGraduacao'));
    if (!(await noCadastro(identidade, 'REABRIR'))) {
      await getTurmasEncerradasRepository().reabrir(identidade);
    }
    return NextResponse.json({ success: true });
  } catch (error) {
    return tratarErro(error, 'Erro ao reabrir turma:');
  }
}
