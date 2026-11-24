import { NextResponse } from 'next/server';
import { validarAlteracaoPreferencias } from '@/lib/preferenciasSolicitacao';
import { exigirGestaoComAutor } from '@/server/application/autorGestao';
import { alterarPreferenciasDoPedido, type ResultadoPreferencias } from '@/server/application/preferenciasPedido';
import { falhaGestao } from '@/server/application/respostaGestao';
import { captureStateAsSnapshot, getCaptureRepository } from '@/server/persistence/captureRepository';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * Alteração das preferências do pedido pela Gestão (4.04). A original
 * continua guardada; o histórico recebe o antes e o depois de cada campo.
 */
export async function PUT(request: Request) {
  try {
    const { autor } = await exigirGestaoComAutor();
    const body = (await request.json().catch(() => ({}))) as Record<string, unknown>;
    const leadId = String(body.leadId ?? '').trim();
    if (!leadId) return NextResponse.json({ success: false, error: 'Selecione a solicitação.' }, { status: 400 });
    const validacao = validarAlteracaoPreferencias(body);
    if (!validacao.ok) return NextResponse.json({ success: false, error: validacao.erro }, { status: 400 });

    const resultado = await getCaptureRepository().mutate<ResultadoPreferencias>((state) => {
      const handled = alterarPreferenciasDoPedido(
        captureStateAsSnapshot(state), leadId, validacao.valores, autor, validacao.motivo
      );
      return {
        next: handled.situacao === 'alterado'
          ? { ...state, triagensPacientes: handled.snapshot.triagensPacientes ?? [] }
          : state,
        result: handled,
      };
    });

    if (resultado.situacao === 'nao_encontrado') {
      return NextResponse.json({ success: false, error: 'Solicitação não encontrada.' }, { status: 404 });
    }
    if (resultado.situacao === 'sem_mudanca') {
      return NextResponse.json({ success: false, error: 'Nenhuma preferência foi alterada.' }, { status: 409 });
    }
    if ('erro' in resultado) {
      return NextResponse.json({ success: false, error: resultado.erro }, { status: 400 });
    }
    if (!('lead' in resultado)) {
      return NextResponse.json({ success: false, error: 'Falha ao alterar as preferências.' }, { status: 500 });
    }
    return NextResponse.json({ success: true, data: resultado.lead });
  } catch (error) {
    return falhaGestao(error, 'Erro ao alterar preferências', 'Falha ao alterar as preferências.');
  }
}
