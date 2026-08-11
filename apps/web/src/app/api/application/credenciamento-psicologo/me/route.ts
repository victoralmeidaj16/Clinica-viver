import { NextResponse } from 'next/server';
import { readSession, type AuthSession } from '@/server/auth';
import { getApplicationStore } from '@/server/application/store';
import { getCaptureRepository } from '@/server/persistence/captureRepository';
import type { CadastroPsicologoRecord } from '@/server/application/persistence';
import {
  aplicarMudancas,
  CAMPOS_DO_PROPRIO_PSICOLOGO,
  CorpoInvalidoError,
  validarCorpo,
} from '@/server/application/psychologistRegistration';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

class SemAcessoError extends Error {
  constructor(message: string, readonly status: number) {
    super(message);
    this.name = 'SemAcessoError';
  }
}

/**
 * Resolve qual cadastro pertence a quem está pedindo.
 *
 * A ligação canônica é `usuarioRef`, gravado por `provisionPsychologistAccess`
 * na aprovação. Antes a busca era por comparação de e-mail, o que funcionava
 * até a gestão editar o e-mail do profissional: dali em diante ele abria o
 * próprio perfil e via "nenhuma candidatura vinculada", com o vínculo correto
 * intacto no banco ao lado.
 *
 * O e-mail continua como segunda tentativa, para cadastros aprovados antes de
 * `usuarioRef` existir — e quando acerta por ali, grava o vínculo, de modo que
 * a próxima consulta já use o caminho curto.
 */
async function cadastroDaSessao(session: AuthSession): Promise<CadastroPsicologoRecord | null> {
  const store = getApplicationStore();
  const membership = await store.identities.findMembershipByUser(
    session.organizationId,
    session.userId
  );
  if (
    !membership ||
    membership.status !== 'active' ||
    membership.roles.some((role) => role === 'owner' || role === 'admin')
  ) {
    throw new SemAcessoError('Acesso disponível apenas para psicólogos.', 403);
  }

  const repositorio = getCaptureRepository();
  const state = await repositorio.read();

  const porUsuario = state.cadastrosPsicologos.find((item) => item.usuarioRef === session.userId);
  if (porUsuario) return porUsuario;

  const user = await store.identities.getUser(session.userId);
  const email = user?.normalizedEmail?.trim().toLocaleLowerCase('pt-BR');
  if (!email) return null;

  const porEmail = state.cadastrosPsicologos.find(
    (item) => item.email?.trim().toLocaleLowerCase('pt-BR') === email
  );
  if (!porEmail) return null;

  const vinculado: CadastroPsicologoRecord = { ...porEmail, usuarioRef: session.userId };
  await repositorio.mutate((atual) => ({
    next: {
      ...atual,
      cadastrosPsicologos: atual.cadastrosPsicologos.map((psi) =>
        psi.id === vinculado.id ? vinculado : psi
      ),
    },
    result: null,
  }));
  return vinculado;
}

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
