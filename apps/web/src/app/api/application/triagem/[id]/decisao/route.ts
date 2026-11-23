import { NextResponse } from 'next/server';
import { captureStateAsSnapshot, getCaptureRepository } from '@/server/persistence/captureRepository';
import { aceitarPaciente, ofertaExpirada, type AceitePacienteResult } from '@/server/application/viverMaisRodizio';

const PRAZO_ENCERRADO = 'O prazo de 24h para responder a esta solicitação terminou. Ela seguiu para outro profissional ou para a coordenação da clínica.';
import { reconciliarPacientes } from '@/server/application/patientPromotion';
import { avisarConfirmacaoPaciente } from '@/server/application/viverMaisWhatsApp';
import { validarTokenConfirmacao } from '@/server/viverMaisConfirmToken';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

function credenciais(request: Request, id: string) {
  const url = new URL(request.url);
  const psicologoId = url.searchParams.get('psi');
  const token = url.searchParams.get('t');
  return {
    psicologoId,
    valido: Boolean(psicologoId && validarTokenConfirmacao(id, psicologoId, token)),
  };
}

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { psicologoId, valido } = credenciais(request, id);
  if (!valido || !psicologoId) {
    return NextResponse.json({ success: false, error: 'Link inválido ou expirado.' }, { status: 403 });
  }

  const state = await getCaptureRepository().read();
  const lead = state.triagensPacientes.find((item) => item.id === id);
  if (!lead) return NextResponse.json({ success: false, error: 'Solicitação não encontrada.' }, { status: 404 });
  if (lead.psicologoAlocadoId !== psicologoId) {
    return NextResponse.json({ success: false, error: 'Este paciente já foi encaminhado a outro profissional.' }, { status: 409 });
  }
  if (ofertaExpirada(lead)) return NextResponse.json({ success: false, error: PRAZO_ENCERRADO }, { status: 409 });
  const estado = lead.confirmadoEm || lead.status === 'CONTATO_CONFIRMADO'
    ? 'CONFIRMADO'
    : lead.aceitoEm
      ? 'ACEITO'
      : 'PENDENTE';
  return NextResponse.json({ success: true, estado });
}

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const { psicologoId, valido } = credenciais(request, id);
    if (!valido || !psicologoId) {
      return NextResponse.json({ success: false, error: 'Link inválido ou expirado.' }, { status: 403 });
    }

    const repositorio = getCaptureRepository();
    const resultado = await repositorio.mutate<AceitePacienteResult>((state) => {
      const handled = aceitarPaciente(captureStateAsSnapshot(state), id, psicologoId);
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
      return NextResponse.json({ success: false, error: 'Este paciente já foi encaminhado a outro profissional.' }, { status: 409 });
    }
    if (resultado.kind === 'expired') {
      return NextResponse.json({ success: false, error: PRAZO_ENCERRADO }, { status: 409 });
    }
    if (resultado.kind === 'accepted') {
      // O aceite conclui a decisão: o paciente recebe as orientações sobre os
      // próximos passos neste momento, e o psicólogo assume o contato
      // (especificação final, 5.03, 7.02 e 12.01). A chave de envio é a mesma
      // da confirmação de contato, então a mensagem não sai duas vezes. Uma
      // falha de WhatsApp não desfaz o aceite já gravado.
      const [promocao] = await Promise.allSettled([
        reconciliarPacientes(repositorio),
        avisarConfirmacaoPaciente(resultado.lead).catch((erro: unknown) => {
          // Só a mensagem do erro: valor cru poderia carregar contato do paciente.
          console.error('[triagem] Aceite registrado; orientações ao paciente não enviadas:', erro instanceof Error ? erro.message : 'erro desconhecido');
        }),
      ]);
      if (promocao.status === 'rejected') throw promocao.reason;
    }
    return NextResponse.json({
      success: true,
      estado: resultado.kind === 'already_confirmed' ? 'CONFIRMADO' : 'ACEITO',
    });
  } catch (error) {
    console.error('Erro ao registrar decisão do encaminhamento:', error);
    return NextResponse.json({ success: false, error: 'Falha ao registrar sua decisão.' }, { status: 500 });
  }
}
