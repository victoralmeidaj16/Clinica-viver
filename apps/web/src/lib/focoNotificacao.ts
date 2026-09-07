/**
 * O destino de um clique no sino.
 *
 * Cada notificação já sabia em que página o assunto dela mora; o que faltava
 * era dizer *onde* na página. O endereço passa a carregar `foco=<alvo>`, e o
 * alvo é o mesmo texto que a tela escreve em `data-foco` na linha, no cartão
 * ou na seção correspondente. Assim quem clica em "prazo de contato vencido"
 * cai na fila com aquele paciente realçado, e não no topo de uma lista de
 * trinta linhas parecidas.
 *
 * O alvo é montado aqui, de um lado, e consumido pelo hook `useFocoNotificacao`
 * do outro — as duas pontas nunca escrevem a string à mão.
 */

export const PARAM_FOCO = 'foco';

/** Um lead da fila de triagem, no cockpit da gestão. */
export const focoLead = (leadId: string) => `lead-${leadId}`;

/** Um paciente na lista de pacientes do profissional. */
export const focoPaciente = (pacienteId: string) => `paciente-${pacienteId}`;

/** Uma sessão na agenda do profissional. */
export const focoSessao = (agendamentoId: string) => `sessao-${agendamentoId}`;

/** Um pagamento conciliado no extrato do profissional. */
export const focoPagamento = (pagamentoRef: string) => `pagamento-${pagamentoRef}`;

/** Uma candidatura na aba de credenciamentos. */
export const focoCredenciamento = (cadastroId: string) => `credenciamento-${cadastroId}`;

/** Um profissional na lista da gestão. */
export const focoPsicologo = (cadastroId: string) => `psicologo-${cadastroId}`;

/**
 * Seções sem item próprio — o assunto é a seção inteira, não uma linha dela.
 * Ficam nomeadas aqui para que página e notificação não divirjam num typo.
 */
export const FOCO_SECAO = {
  statusCredenciamento: 'secao-status-credenciamento',
  minhaPratica: 'secao-minha-pratica',
  listaPacientes: 'secao-lista-pacientes',
} as const;

/** Abas do cockpit da gestão que uma notificação pode abrir. */
export type AbaCockpitGestao = 'fila' | 'credenciamentos' | 'profissionais';

export const PARAM_ABA = 'aba';

/** Monta o endereço da notificação preservando a ordem dos parâmetros. */
export function comFoco(
  caminho: string,
  foco: string,
  extras: Readonly<Record<string, string>> = {}
): string {
  const parametros = new URLSearchParams();
  for (const [chave, valor] of Object.entries(extras)) parametros.set(chave, valor);
  parametros.set(PARAM_FOCO, foco);
  return `${caminho}?${parametros.toString()}`;
}
