import 'server-only';

import { readSession } from '@/server/auth';

/**
 * Porteiro das rotas de gestão da clínica (fila, credenciamento, SLA).
 *
 * Usa a sessão real de `server/auth.ts` — o mesmo cookie assinado do login —,
 * e não o contexto de `resolveRequestContext`, que exige vínculo organizacional
 * no store da aplicação. A fila e o credenciamento vivem no snapshot da
 * vitrine, fora daquele agregado; amarrá-los a uma associação que eles não
 * possuem deixaria o cockpit inacessível por um motivo que nada tem a ver com
 * quem pode vê-lo.
 *
 * Estas rotas expõem nome e telefone de quem procurou a clínica. Antes desta
 * trava não havia nenhuma: a fila era legível por qualquer requisição.
 */

export class NaoAutorizadoError extends Error {
  readonly status: number;

  constructor(status: 401 | 403, mensagem: string) {
    super(mensagem);
    this.name = 'NaoAutorizadoError';
    this.status = status;
  }
}

/** Exige sessão ativa com papel de gestão. */
export async function exigirGestao(): Promise<void> {
  const sessao = await readSession();
  if (!sessao) throw new NaoAutorizadoError(401, 'Faça login para continuar.');
  if (sessao.role !== 'admin') {
    throw new NaoAutorizadoError(403, 'Esta área é restrita à gestão da clínica.');
  }
}

/**
 * A mesma pergunta de `exigirGestao`, respondida sem lançar.
 *
 * Serve a quem precisa decidir entre dois caminhos válidos em vez de barrar —
 * é o caso do teto por IP na entrada de leads, que a gestão pode ultrapassar
 * cadastrando quem chegou pelo WhatsApp.
 */
export async function ehGestao(): Promise<boolean> {
  const sessao = await readSession();
  return sessao?.role === 'admin';
}

/**
 * Autoriza a varredura do SLA.
 *
 * Dois caminhos, porque ela tem dois chamadores legítimos: o agendador, que
 * não tem sessão e se identifica por `SLA_SWEEP_TOKEN`, e a gestão abrindo o
 * cockpit. Sem a variável configurada, resta o segundo — o modo padrão é o
 * fechado.
 */
export async function exigirVarreduraAutorizada(request: Request): Promise<void> {
  const esperado = process.env.SLA_SWEEP_TOKEN?.trim();
  if (esperado && request.headers.get('x-sla-token') === esperado) return;
  await exigirGestao();
}
