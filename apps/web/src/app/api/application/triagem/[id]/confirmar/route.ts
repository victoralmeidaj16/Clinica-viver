import { NextResponse } from 'next/server';
import { captureStateAsSnapshot, getCaptureRepository } from '@/server/persistence/captureRepository';
import { validarTokenConfirmacao } from '@/server/viverMaisConfirmToken';
import { confirmarContato, type ConfirmacaoResult } from '@/server/application/viverMaisRodizio';
import { avisarConfirmacaoPaciente } from '@/server/application/viverMaisWhatsApp';
import { respostaLotacao } from '../lotacao';
import { reconciliarPacientes } from '@/server/application/patientPromotion';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * Confirmação de primeiro contato pelo psicólogo.
 *
 * Rota pública por necessidade — quem clica veio do WhatsApp, sem sessão — e
 * autorizada pelo token assinado do link. O par lead + psicólogo está dentro da
 * assinatura, então o link de uma alocação não confirma outra, e o link de
 * quem perdeu o lead no transbordo não serve mais.
 *
 * Idempotente: reconfirmar devolve sucesso e preserva a hora original. Quem
 * clica duas vezes no WhatsApp não deve ver erro, e a primeira confirmação é a
 * que vale para o SLA.
 */
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const url = new URL(request.url);
    const psicologoId = url.searchParams.get('psi');
    const token = url.searchParams.get('t');

    if (!psicologoId || !validarTokenConfirmacao(id, psicologoId, token)) {
      return NextResponse.json(
        { success: false, error: 'Link de confirmação inválido ou expirado.' },
        { status: 403 }
      );
    }

    const repositorio = getCaptureRepository();
    const resultado = await repositorio.mutate<ConfirmacaoResult>((state) => {
      const handled = confirmarContato(captureStateAsSnapshot(state), id, psicologoId);
      return {
        next: {
          triagensPacientes: handled.next.triagensPacientes ?? [],
          cadastrosPsicologos: handled.next.cadastrosPsicologos ?? [],
        },
        result: handled.result,
      };
    });

    if (resultado.kind === 'not_found') {
      return NextResponse.json({ success: false, error: 'Solicitação não encontrada.' }, { status: 404 });
    }
    if (resultado.kind === 'conflict') {
      return NextResponse.json(
        { success: false, error: 'Este atendimento já foi encaminhado a outro profissional porque o prazo de resposta terminou.' },
        { status: 409 }
      );
    }
    if (resultado.kind === 'expired') {
      return NextResponse.json({ success: false, error: 'O prazo para responder a esta solicitação terminou. Ela seguiu para outro profissional ou para a coordenação da clínica.' }, { status: 409 });
    }
    if (resultado.kind === 'capacity_reallocated' || resultado.kind === 'capacity_pending') {
      return respostaLotacao(resultado);
    }

    // As orientações saem no aceite (rota `decisao`). Aqui o envio é só rede
    // de segurança para quem foi aceito antes dessa mudança ou cujo envio no
    // aceite não chegou a ser reservado: a chave é a mesma, então quem já
    // recebeu não recebe de novo.
    if (resultado.kind === 'confirmed') {
      await avisarConfirmacaoPaciente(resultado.lead);
    }

    // A confirmação já foi commitada. Se a identidade estiver temporariamente
    // indisponível, a resposta continua sendo sucesso e o SLA sweep fecha a
    // ponte depois; nunca desfazemos uma confirmação verdadeira.
    try {
      await reconciliarPacientes(repositorio);
    } catch (promotionError) {
      console.error('Confirmação registrada; promoção pendente de reconciliação:', promotionError);
    }

    return NextResponse.json({
      success: true,
      jaConfirmado: resultado.kind === 'already_confirmed',
      data: resultado.data,
    });
  } catch (error) {
    console.error('Erro ao confirmar contato:', error);
    return NextResponse.json({ success: false, error: 'Falha ao registrar a confirmação.' }, { status: 500 });
  }
}
