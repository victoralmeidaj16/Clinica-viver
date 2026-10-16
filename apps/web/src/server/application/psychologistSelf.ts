import 'server-only';

import type { AuthSession } from '@/server/auth';
import { getApplicationStore } from '@/server/application/store';
import { getCaptureRepository } from '@/server/persistence/captureRepository';
import type { CadastroPsicologoRecord } from '@/server/application/persistence';

export class SemAcessoError extends Error {
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
 *
 * Vive fora das rotas porque tem dois chamadores: o perfil que o profissional
 * edita e o sino de notificações, que precisa saber de quem são os pacientes
 * antes de montar a lista.
 */
export async function cadastroDaSessao(
  session: AuthSession
): Promise<CadastroPsicologoRecord | null> {
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

  const porUsuario = state.cadastrosPsicologos.filter((item) => item.usuarioRef === session.userId);
  if (porUsuario.length > 1) throw new SemAcessoError('Há mais de um cadastro vinculado a esta conta. Procure a gestão para revisar seu acesso.', 409);
  if (porUsuario[0]) return porUsuario[0];

  const user = await store.identities.getUser(session.userId);
  const email = user?.normalizedEmail?.trim().toLocaleLowerCase('pt-BR');
  if (!email) return null;

  const porEmail = state.cadastrosPsicologos.filter(
    (item) => item.email?.trim().toLocaleLowerCase('pt-BR') === email
  );
  if (porEmail.length > 1 || porEmail.some((item) => item.usuarioRef && item.usuarioRef !== session.userId)) {
    throw new SemAcessoError('O vínculo deste cadastro precisa ser revisado pela gestão.', 409);
  }
  if (!porEmail[0]) return null;

  return repositorio.mutate((atual) => {
    const candidatos = atual.cadastrosPsicologos.filter((item) => item.usuarioRef === session.userId
      || item.email?.trim().toLocaleLowerCase('pt-BR') === email);
    if (candidatos.length !== 1 || (candidatos[0].usuarioRef && candidatos[0].usuarioRef !== session.userId)) {
      throw new SemAcessoError('O vínculo deste cadastro precisa ser revisado pela gestão.', 409);
    }
    const vinculado: CadastroPsicologoRecord = { ...candidatos[0], usuarioRef: session.userId };
    return {
      next: {
        ...atual,
        cadastrosPsicologos: atual.cadastrosPsicologos.map((psi) => psi.id === vinculado.id ? vinculado : psi),
      },
      result: vinculado,
    };
  });
}
