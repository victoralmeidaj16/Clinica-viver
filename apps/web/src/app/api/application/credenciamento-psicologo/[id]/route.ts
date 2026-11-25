import { CATALOGO_CURSOS_PADRAO } from '@/components/forms/opcoesPsicologo';
import { obterCatalogoCursos } from '@/server/application/catalogoCursos';
import { NextResponse } from 'next/server';
import { CadastroDuplicadoError, assertCadastroUnico } from '@/server/application/psychologistUniqueness';
import { isMysqlConfigured } from '@/server/oci/runtime';
import { getCaptureRepository } from '@/server/persistence/captureRepository';
import { exigirGestao, NaoAutorizadoError } from '@/server/viverMaisGestaoAuth';
import {
  aplicarMudancas,
  assertDecisaoDoPedidoAtual,
  CAMPOS_DA_GESTAO,
  CorpoInvalidoError,
  validarCorpo,
} from '@/server/application/psychologistRegistration';
import {
  CadastroIncompletoError,
  validateApprovalAccess,
} from '@/server/application/psychologistAccess';
import { enviarConvitePsicologo } from '@/server/application/psychologistInvitation';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/** Edição parcial do credenciamento, da visibilidade na vitrine e da pausa no rodízio. */
export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    await exigirGestao();

    const { id } = await params;
    const corpo = await request.json();

    await validarCorpo(corpo);
    const catalogo = await obterCatalogoCursos().catch(() => [...CATALOGO_CURSOS_PADRAO]);
    const usaMysql = isMysqlConfigured();
    const atualizado = await getCaptureRepository().mutate((state) => {
      const existente = state.cadastrosPsicologos.find((psi) => psi.id === id);
      if (!existente) throw new CorpoInvalidoError('Cadastro não encontrado.', 404);
      if (usaMysql) assertDecisaoDoPedidoAtual(existente, corpo);
      const next = aplicarMudancas(existente, corpo, CAMPOS_DA_GESTAO, catalogo);
      if (usaMysql && next.status === 'APROVADO') validateApprovalAccess(next);
      if (!usaMysql) assertCadastroUnico(next, state.cadastrosPsicologos);
      return {
        next: {
          ...state,
          cadastrosPsicologos: state.cadastrosPsicologos.map((psi) => psi.id === id ? next : psi),
        },
        result: next,
      };
    });

    if (usaMysql && atualizado.status === 'APROVADO' && (!atualizado.usuarioRef || !atualizado.boasVindasEnviadaEm)) {
      const convite = await enviarConvitePsicologo(atualizado);
      return NextResponse.json({
        success: true,
        data: atualizado,
        acesso: {
          criado: true,
          boasVindas: convite.whatsapp,
          email: convite.email.situacao,
          emailCodigo: convite.email.codigo,
          emailDetalhe: convite.email.detalhe,
        },
      });
    }

    return NextResponse.json({ success: true, data: atualizado });
  } catch (error) {
    if (error instanceof CorpoInvalidoError) {
      return NextResponse.json({ success: false, error: error.message }, { status: error.status });
    }
    if (error instanceof CadastroDuplicadoError) {
      return NextResponse.json({ success: false, code: error.code, error: error.message }, { status: error.status });
    }
    if (error instanceof CadastroIncompletoError) {
      return NextResponse.json({ success: false, error: error.message, campos: error.campos }, { status: 422 });
    }
    if (error instanceof NaoAutorizadoError) {
      return NextResponse.json({ success: false, error: error.message }, { status: error.status });
    }
    console.error('Erro ao atualizar cadastro de psicólogo:', error);
    return NextResponse.json({ success: false, error: 'Falha ao atualizar o cadastro.' }, { status: 500 });
  }
}
