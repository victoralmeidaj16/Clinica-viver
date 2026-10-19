/** Durações fixas oferecidas na grade de disponibilidade. */
export const DURACOES_SESSAO = [50, 90] as const;

export const DURACAO_VARIAVEL_MIN = 15;
export const DURACAO_VARIAVEL_MAX = 240;

const POS_AVALIACAO_PSICOLOGICA = 'Pós-graduação em Avaliação Psicológica';

/**
 * Avaliação psicológica não cabe em 50 min nem em 1h30: o tempo depende do
 * instrumento aplicado. Por isso só os alunos dessa pós escolhem a duração.
 */
export function permiteDuracaoVariavel(cadastro: {
  posGraduacaoViverMais?: string;
  segundaPosGraduacao?: string;
} | undefined): boolean {
  return cadastro?.posGraduacaoViverMais === POS_AVALIACAO_PSICOLOGICA
    || cadastro?.segundaPosGraduacao === POS_AVALIACAO_PSICOLOGICA;
}
