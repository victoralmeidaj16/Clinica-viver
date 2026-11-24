import { NextResponse } from 'next/server';
import { getCaptureRepository } from '@/server/persistence/captureRepository';
import { NaoAutorizadoError } from '@/server/viverMaisGestaoAuth';
import { exigirGestaoComAutor } from '@/server/application/autorGestao';
import { registrarAlteracao } from '@/server/application/auditoriaAlteracoes';
import { CorpoInvalidoError, validarCorpo } from '@/server/application/psychologistRegistration';
import { limitePacientesValido, mensagemLimitePacientesInvalido } from '@/lib/psychologistCapacity';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function PATCH(request: Request) {
  try {
    const { sessao, autor } = await exigirGestaoComAutor();
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
        result: {
          atualizados: state.cadastrosPsicologos.length,
          acimaDoLimite,
          anteriores: [...new Set(state.cadastrosPsicologos.map((p) => p.limitePacientesAtivos ?? 'padrão'))].join(', '),
        },
      };
    });
    // Limite anterior e novo da equipe (13.02).
    await registrarAlteracao({ organizationId: sessao.organizationId, modulo: 'psicologos', entidadeTipo: 'equipe',
      entidadeRef: 'limite_pacientes_ativos', entidadeRotulo: 'Limite de pacientes ativos da equipe', acao: 'alterar_limite_pacientes',
      campos: resultado.anteriores === String(limite) ? [] : [{ campo: 'limitePacientesAtivos', rotulo: 'Limite de pacientes ativos',
        anterior: resultado.anteriores || '—', novo: String(limite) }], autor });

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
