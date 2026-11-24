import { NextResponse } from 'next/server';
import { modoListaEsperaValido } from '@/lib/listaEspera';
import { exigirGestaoComAutor } from '@/server/application/autorGestao';
import {
  alterarListaDeEspera,
  colocarNaListaDeEspera,
  retirarDaListaDeEspera,
  type ResultadoListaEspera,
} from '@/server/application/listaEspera';
import { executarListaDeEsperaSemFalhar } from '@/server/application/listaEsperaExecucao';
import { falhaGestao } from '@/server/application/respostaGestao';
import { captureStateAsSnapshot, getCaptureRepository } from '@/server/persistence/captureRepository';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const MENSAGENS: Record<Exclude<ResultadoListaEspera['situacao'], 'ok'>, [number, string]> = {
  nao_encontrado: [404, 'Solicitação não encontrada.'],
  nao_aplicavel: [409, 'Só entra na lista de espera um pedido que aguarda decisão da Gestão.'],
  ja_na_lista: [409, 'Este paciente já está na lista de espera.'],
  fora_da_lista: [409, 'Este paciente não está na lista de espera.'],
  motivo_obrigatorio: [400, 'Informe o motivo da prioridade excepcional.'],
  sem_mudanca: [409, 'Nada foi alterado.'],
};

/**
 * Lista de espera da Gestão (especificação final, 5.06 e 5.07).
 *
 * `acao`: `ENTRAR` (com `modo` e, opcionalmente, `prioritario` e
 * `motivoPrioridade`), `ALTERAR` (modo e/ou prioridade) ou `RETIRAR`.
 * Depois de gravar, a lista automática é processada: se já houver vaga
 * compatível, a oferta sai agora.
 */
export async function POST(request: Request) {
  try {
    const { autor } = await exigirGestaoComAutor();
    const body = (await request.json().catch(() => ({}))) as Record<string, unknown>;
    const leadId = String(body.leadId ?? '').trim();
    const acao = body.acao;
    if (!leadId) return NextResponse.json({ success: false, error: 'Selecione a solicitação.' }, { status: 400 });
    if (acao !== 'ENTRAR' && acao !== 'ALTERAR' && acao !== 'RETIRAR') {
      return NextResponse.json({ success: false, error: 'Ação desconhecida para a lista de espera.' }, { status: 400 });
    }
    if ((acao === 'ENTRAR' || body.modo !== undefined) && !modoListaEsperaValido(body.modo)) {
      return NextResponse.json({ success: false, error: 'Escolha o modo automático ou manual.' }, { status: 400 });
    }
    const modo = modoListaEsperaValido(body.modo) ? body.modo : undefined;
    const prioritario = typeof body.prioritario === 'boolean' ? body.prioritario : undefined;
    const motivoPrioridade = typeof body.motivoPrioridade === 'string' ? body.motivoPrioridade : undefined;
    const motivo = typeof body.motivo === 'string' ? body.motivo : undefined;

    const resultado = await getCaptureRepository().mutate((state) => {
      const snapshot = captureStateAsSnapshot(state);
      const handled = acao === 'ENTRAR'
        ? colocarNaListaDeEspera(snapshot, leadId, { modo: modo!, prioritario, motivoPrioridade }, autor)
        : acao === 'ALTERAR'
          ? alterarListaDeEspera(snapshot, leadId, { modo, prioritario, motivoPrioridade }, autor)
          : retirarDaListaDeEspera(snapshot, leadId, motivo, autor);
      return {
        next: handled.situacao === 'ok'
          ? { ...state, triagensPacientes: handled.snapshot.triagensPacientes ?? [] }
          : state,
        result: handled,
      };
    });

    if (resultado.situacao !== 'ok') {
      const [status, error] = MENSAGENS[resultado.situacao];
      return NextResponse.json({ success: false, error }, { status });
    }
    if (resultado.lead.listaEspera?.modo === 'AUTOMATICO') await executarListaDeEsperaSemFalhar();
    return NextResponse.json({ success: true, data: resultado.lead });
  } catch (error) {
    return falhaGestao(error, 'Erro na lista de espera', 'Falha ao atualizar a lista de espera.');
  }
}
