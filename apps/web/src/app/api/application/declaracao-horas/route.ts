import { NextResponse } from 'next/server';
import { readSession } from '@/server/auth';
import { exigirGestao, NaoAutorizadoError } from '@/server/viverMaisGestaoAuth';
import { ApplicationError, failure, readJson, success } from '@/server/application/http';
import {
  emitirDeclaracao,
  enderecoDeConferencia,
  listarPsicologosParaDeclaracao,
  previaDeclaracao,
} from '@/server/application/declaracaoHorasService';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * Declaração de horas de atendimento — emissão pela gestão.
 *
 * Esta rota **não tinha autenticação nenhuma**: uma requisição sem sessão
 * devolvia nome, CRP e contagem de sessões de qualquer psicólogo, bastando
 * variar o parâmetro `nome`. O `proxy.ts` libera tudo sob `/api/` e delega a
 * autorização a cada rota; esta simplesmente não fazia a sua parte.
 *
 * A emissão é da coordenação, não do psicólogo: quem declara a carga horária é
 * a clínica. Por isso `exigirGestao` em vez de sessão qualquer.
 */

function respostaDeErro(erro: unknown) {
  if (erro instanceof NaoAutorizadoError) {
    return NextResponse.json({ ok: false, error: { code: 'FORBIDDEN', message: erro.message } }, { status: erro.status });
  }
  return failure(erro);
}

/**
 * Sem `psicologoId`, a lista de quem pode receber declaração. Com ele, a prévia
 * daquele psicólogo — o mesmo cálculo que a emissão fará, sem gravar nada.
 */
export async function GET(request: Request) {
  try {
    await exigirGestao();
    const sessao = await readSession();
    if (!sessao) throw new NaoAutorizadoError(401, 'Faça login para continuar.');

    const psicologoId = new URL(request.url).searchParams.get('psicologoId');
    if (!psicologoId) {
      return success({ psicologos: await listarPsicologosParaDeclaracao() });
    }

    return success(await previaDeclaracao(sessao.organizationId, psicologoId));
  } catch (erro) {
    return respostaDeErro(erro);
  }
}

export async function POST(request: Request) {
  try {
    await exigirGestao();
    const sessao = await readSession();
    if (!sessao) throw new NaoAutorizadoError(401, 'Faça login para continuar.');

    const corpo = await readJson(request);
    const psicologoId = typeof corpo.psicologoId === 'string' ? corpo.psicologoId.trim() : '';
    if (!psicologoId) {
      throw new ApplicationError('INVALID_INPUT', 'Informe o psicólogo da declaração.', 400);
    }

    const declaracao = await emitirDeclaracao(sessao.organizationId, sessao.userId, psicologoId);

    // O hash e os ids das sessões ficam no servidor: a tela imprime a
    // declaração, e nada no papel precisa deles.
    return success(
      {
        codigo: declaracao.codigo,
        urlConferencia: enderecoDeConferencia(declaracao.codigo),
        psicologoNome: declaracao.psicologoNome,
        psicologoCrp: declaracao.psicologoCrp,
        tratamento: declaracao.tratamento,
        curso: declaracao.curso,
        periodoInicio: declaracao.periodoInicio,
        periodoFim: declaracao.periodoFim,
        totalSessoes: declaracao.totalSessoes,
        totalHoras: declaracao.totalHoras,
        coordenadora: declaracao.coordenadora,
        supervisora: declaracao.supervisora,
        emitidoEm: declaracao.emitidoEm,
      },
      201
    );
  } catch (erro) {
    return respostaDeErro(erro);
  }
}
