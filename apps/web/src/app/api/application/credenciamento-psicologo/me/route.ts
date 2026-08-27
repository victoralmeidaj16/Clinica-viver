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
import { diferencasDoCadastro } from '@/lib/perfilPsicologoDiff';
import { getPerfilAlteracoesRepository } from '@/server/persistence/perfilAlteracoes';
import { nomeDeExibicao } from '@/server/application/viverMaisRodizio';
import type { CadastroPsicologoRecord } from '@/server/application/persistence';
import { getApplicationStore } from '@/server/application/store';

/**
 * Avisa a coordenação do que o profissional acabou de mudar.
 *
 * Roda **depois** da gravação e nunca derruba o PATCH: a edição é um direito do
 * profissional, e uma falha ao registrar o aviso não pode desfazer — nem
 * parecer que desfez — uma alteração que já está no banco. O pior caso é a
 * gestão não ver este aviso específico, e isso vai para o log.
 */
async function avisarGestao(
  antes: CadastroPsicologoRecord,
  depois: CadastroPsicologoRecord,
  usuarioRef: string
): Promise<void> {
  try {
    const mudancas = diferencasDoCadastro(
      antes as unknown as Record<string, unknown>,
      depois as unknown as Record<string, unknown>,
      CAMPOS_DO_PROPRIO_PSICOLOGO
    );
    // Salvar sem mexer em nada é comum — o formulário reenvia o cadastro
    // inteiro. Gravar isso encheria o sino de "alterou: nada".
    if (mudancas.length === 0) return;

    await getPerfilAlteracoesRepository().registrar({
      cadastroRef: depois.id,
      psicologoNome: nomeDeExibicao(depois),
      alteradoEm: new Date().toISOString(),
      mudancas,
      usuarioRef,
    });
  } catch (error) {
    console.error('Erro ao registrar alteração de perfil para a gestão:', error);
  }
}

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
 * turnos, público, minibio, foto — muda sem intermediário, porque quem sabe
 * disso é ele e a alternativa é a gestão virar cartório de recado. O nome, CRP
 * e e-mail também pertencem ao profissional e são sincronizados com sua
 * identidade de acesso. Status, vitrine, capacidade e os serviços homologados
 * seguem protegidos — estes últimos mudam só por solicitação aprovada.
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

    // O credenciamento alimenta a vitrine; identidade e perfil profissional
    // alimentam login, agenda e prontuário. Os três precisam refletir a mesma
    // edição para não criar versões divergentes do nome, CRP ou e-mail.
    const store = getApplicationStore();
    const now = new Date().toISOString();
    const user = await store.identities.getUser(session.userId);
    if (user) {
      await store.identities.saveUser({
        ...user,
        displayName: atualizado.nomeSocial?.trim() || atualizado.nomeCompleto,
        normalizedEmail: atualizado.email?.trim().toLocaleLowerCase('pt-BR'),
        updatedAt: now,
      });
    }
    if (atualizado.profissionalRef) {
      const professional = await store.identities.getProfessional(session.organizationId, atualizado.profissionalRef);
      if (professional) {
        await store.identities.saveProfessional({
          ...professional,
          displayName: atualizado.nomeSocial?.trim() || atualizado.nomeCompleto,
          councilRegistration: atualizado.crp,
          updatedAt: now,
        });
      }
    }

    await getCaptureRepository().mutate((state) => ({
      next: {
        ...state,
        cadastrosPsicologos: state.cadastrosPsicologos.map((psi) =>
          psi.id === atualizado.id ? atualizado : psi
        ),
      },
      result: null,
    }));

    await avisarGestao(cadastro, atualizado, session.userId);

    return NextResponse.json({ success: true, data: atualizado });
  } catch (error) {
    return tratarErro(error, 'Erro ao atualizar cadastro do psicólogo:');
  }
}
