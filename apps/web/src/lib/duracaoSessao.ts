/** Durações que podem constar na grade de disponibilidade. */
export const DURACOES_SESSAO = [50, 90] as const;

export const DURACAO_VARIAVEL_MIN = 15;
export const DURACAO_VARIAVEL_MAX = 240;

export interface RegrasDuracaoSessao {
  duracoesFixas: readonly number[];
  permiteVariavel: boolean;
}

const INDIVIDUAL: RegrasDuracaoSessao = { duracoesFixas: [50], permiteVariavel: false };

function normalizar(valor: string): string {
  return valor.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLocaleLowerCase('pt-BR');
}

/**
 * A duração vem do serviço e do público do cadastro, não da pós-graduação:
 * individual usa 50 min; casal/família pode usar 1h30; avaliação também pode
 * informar manualmente o tempo de cada sessão.
 */
export function regrasDuracaoSessao(cadastro: {
  temposAtendimento?: readonly number[];
  servicosPrestados?: readonly string[];
  servicosHabilitados?: readonly string[];
  publicoAlvo?: readonly string[];
} | undefined): RegrasDuracaoSessao {
  const temposConfigurados = cadastro?.temposAtendimento?.filter((tempo): tempo is number => tempo === 50 || tempo === 90);
  if (temposConfigurados?.length) {
    return { duracoesFixas: Array.from(new Set(temposConfigurados)), permiteVariavel: false };
  }
  const servicos = [...(cadastro?.servicosPrestados ?? []), ...(cadastro?.servicosHabilitados ?? [])]
    .map(normalizar);
  const publicos = (cadastro?.publicoAlvo ?? []).map(normalizar);
  const avaliacao = servicos.some((servico) => servico.includes('avaliacao'));
  if (avaliacao) return { duracoesFixas: DURACOES_SESSAO, permiteVariavel: true };

  const casalOuFamilia = publicos.some((publico) => publico.includes('casal') || publico.includes('casai') || publico.includes('familia'));
  return casalOuFamilia ? { duracoesFixas: DURACOES_SESSAO, permiteVariavel: false } : INDIVIDUAL;
}
