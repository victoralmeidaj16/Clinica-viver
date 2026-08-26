import { NextResponse } from 'next/server';
import { getCaptureRepository } from '@/server/persistence/captureRepository';
import { exigirGestao, NaoAutorizadoError } from '@/server/viverMaisGestaoAuth';
import { CorpoInvalidoError, validarCorpo } from '@/server/application/psychologistRegistration';
import { limitePacientesValido, mensagemLimitePacientesInvalido } from '@/lib/psychologistCapacity';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function PATCH(request: Request) {
  try {
    await exigirGestao();
    const corpo = (await request.json()) as Record<string, unknown>;
    await validarCorpo(corpo);
    const limite = Number(corpo.limitePacientesAtivos);
    if (!limitePacientesValido(limite)) {
      throw new CorpoInvalidoError(mensagemLimitePacientesInvalido());
    }

    const resultado = await getCaptureRepository().mutate((state) => {
      const acimaDoLimite = state.cadastrosPsicologos.filter(
        (psicologo) => (psicologo.pacientesAtivosCount ?? 0) > limite
      ).length;
      return {
        next: {
          ...state,
          cadastrosPsicologos: state.cadastrosPsicologos.map((psicologo) => ({
            ...psicologo,
            limitePacientesAtivos: limite,
          })),
        },
        result: { atualizados: state.cadastrosPsicologos.length, acimaDoLimite },
      };
    });

    return NextResponse.json({ success: true, data: { limitePacientesAtivos: limite, ...resultado } });
  } catch (error) {
    if (error instanceof CorpoInvalidoError) {
      return NextResponse.json({ success: false, error: error.message }, { status: error.status });
    }
    if (error instanceof NaoAutorizadoError) {
      return NextResponse.json({ success: false, error: error.message }, { status: error.status });
    }
    console.error('Erro ao atualizar limite de pacientes da equipe:', error);
    return NextResponse.json({ success: false, error: 'Falha ao atualizar a capacidade da equipe.' }, { status: 500 });
  }
}
