import { NextResponse } from 'next/server';
import { readSession } from '@/server/auth';
import { getCaptureRepository } from '@/server/persistence/captureRepository';
import { cadastroDaSessao, SemAcessoError } from '@/server/application/psychologistSelf';
import {
  aplicarMudancas,
  CAMPOS_DO_PROPRIO_PSICOLOGO,
  CorpoInvalidoError,
  validarCorpo,
} from '@/server/application/psychologistRegistration';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

function tratarErro(error: unknown, contexto: string) {
  if (error instanceof SemAcessoError || error instanceof CorpoInvalidoError) {
    return NextResponse.json({ success: false, error: error.message }, { status: error.status });
  }
  console.error(contexto, error);
  return NextResponse.json({ success: false, error: 'Falha ao carregar seu cadastro.' }, { status: 500 });
}

export async function GET() {
  try {
    const session = await readSession();
    if (!session) {
      return NextResponse.json(
        { success: false, error: 'Faça login para acompanhar o cadastro.' },
        { status: 401 }
      );
    }
    const cadastro = await cadastroDaSessao(session);
    return NextResponse.json(
      { success: true, data: cadastro ?? null },
      { headers: { 'Cache-Control': 'no-store' } }
    );
  } catch (error) {
    return tratarErro(error, 'Erro ao carregar cadastro do psicólogo:');
  }
}

/**
 * O profissional edita o próprio perfil.
 *
 * A allowlist é `CAMPOS_DO_PROPRIO_PSICOLOGO`: o que descreve a prática dele —
 * turnos, serviços, público, minibio, foto — muda sem intermediário, porque
 * quem sabe disso é ele e a alternativa é a gestão virar cartório de recado. O
 * que a clínica confere ou decide (CRP, e-mail, status, vitrine, limite de
 * pacientes) não está na lista e é descartado em silêncio se vier no corpo.
 */
export async function PATCH(request: Request) {
  try {
    const session = await readSession();
    if (!session) {
      return NextResponse.json(
        { success: false, error: 'Faça login para editar o cadastro.' },
        { status: 401 }
      );
    }

    const cadastro = await cadastroDaSessao(session);
    if (!cadastro) {
      return NextResponse.json(
        { success: false, error: 'Nenhuma candidatura vinculada a esta conta.' },
        { status: 404 }
      );
    }

    const corpo = (await request.json()) as Record<string, unknown>;
    await validarCorpo(corpo, CAMPOS_DO_PROPRIO_PSICOLOGO);

    const atualizado = aplicarMudancas(cadastro, corpo, CAMPOS_DO_PROPRIO_PSICOLOGO);

    await getCaptureRepository().mutate((state) => ({
      next: {
        ...state,
        cadastrosPsicologos: state.cadastrosPsicologos.map((psi) =>
          psi.id === atualizado.id ? atualizado : psi
        ),
      },
      result: null,
    }));

    return NextResponse.json({ success: true, data: atualizado });
  } catch (error) {
    return tratarErro(error, 'Erro ao atualizar cadastro do psicólogo:');
  }
}
