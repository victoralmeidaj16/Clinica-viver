import 'server-only';

import { readSession, type AuthSession } from '@/server/auth';
import { exigirGestao, NaoAutorizadoError } from '@/server/viverMaisGestaoAuth';
import { getApplicationStore } from './store';

export interface AutorDaSessao {
  usuarioRef: string;
  nome?: string;
}

/** Nome de exibição do usuário, para o histórico. Falha de leitura não bloqueia a ação. */
export async function nomeDoUsuario(userId: string): Promise<string | undefined> {
  try {
    const usuario = await getApplicationStore().identities.getUser(userId);
    return usuario?.displayName?.trim() || undefined;
  } catch {
    return undefined;
  }
}

/**
 * Exige a Gestão e devolve quem está agindo — o autor que a trilha de
 * auditoria grava (13.02). A identidade vem só da sessão assinada.
 */
export async function exigirGestaoComAutor(): Promise<{ sessao: AuthSession; autor: AutorDaSessao }> {
  await exigirGestao();
  const sessao = await readSession();
  if (!sessao) throw new NaoAutorizadoError(401, 'Faça login para continuar.');
  return { sessao, autor: { usuarioRef: sessao.userId, nome: await nomeDoUsuario(sessao.userId) } };
}
