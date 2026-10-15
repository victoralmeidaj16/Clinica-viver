import { NextResponse } from 'next/server';
import { captureStateAsSnapshot, getCaptureRepository } from '@/server/persistence/captureRepository';
import { aceitarPaciente, type AceitePacienteResult } from '@/server/application/viverMaisRodizio';
import { reconciliarPacientes } from '@/server/application/patientPromotion';
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
    if (resultado.kind === 'accepted') await reconciliarPacientes(repositorio);
    return NextResponse.json({
      success: true,
      estado: resultado.kind === 'already_confirmed' ? 'CONFIRMADO' : 'ACEITO',
    });
  } catch (error) {
    console.error('Erro ao registrar decisão do encaminhamento:', error);
    return NextResponse.json({ success: false, error: 'Falha ao registrar sua decisão.' }, { status: 500 });
  }
}
