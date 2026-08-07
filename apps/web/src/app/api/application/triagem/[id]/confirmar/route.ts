import { NextResponse } from 'next/server';
import { readSnapshot, writeSnapshot } from '@/server/application/persistence';
import { validarTokenConfirmacao } from '@/server/viverMaisConfirmToken';

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

    const snapshot = readSnapshot();
    const lead = snapshot?.triagensPacientes?.find((item) => item.id === id);

    if (!snapshot || !lead) {
      return NextResponse.json({ success: false, error: 'Solicitação não encontrada.' }, { status: 404 });
    }

    // O lead pode ter transbordado entre o envio da mensagem e o clique. Nesse
    // caso a confirmação é recusada: quem responde agora não é mais o
    // responsável, e aceitar devolveria o paciente a quem já perdeu o prazo.
    if (lead.psicologoAlocadoId !== psicologoId) {
      return NextResponse.json(
        {
          success: false,
          error: 'Este atendimento já foi encaminhado a outro profissional pelo prazo de 24h.',
        },
        { status: 409 }
      );
    }

    if (lead.confirmadoEm) {
      return NextResponse.json({
        success: true,
        jaConfirmado: true,
        data: { nomePaciente: lead.nomePaciente, telefone: lead.telefone, confirmadoEm: lead.confirmadoEm },
      });
    }

    const confirmado = {
      ...lead,
      status: 'CONTATO_CONFIRMADO' as const,
      confirmadoEm: new Date().toISOString(),
    };

    await writeSnapshot({
      ...snapshot,
      savedAt: new Date().toISOString(),
      triagensPacientes: (snapshot.triagensPacientes ?? []).map((item) =>
        item.id === id ? confirmado : item
      ),
    });

    return NextResponse.json({
      success: true,
      jaConfirmado: false,
      data: {
        nomePaciente: confirmado.nomePaciente,
        telefone: confirmado.telefone,
        confirmadoEm: confirmado.confirmadoEm,
      },
    });
  } catch (error) {
    console.error('Erro ao confirmar contato:', error);
    return NextResponse.json({ success: false, error: 'Falha ao registrar a confirmação.' }, { status: 500 });
  }
}
