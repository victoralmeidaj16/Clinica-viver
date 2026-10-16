import type { ModalidadeAtendimento } from '@thats-life/core';

/**
 * Traduz a modalidade (faixa de valor) da vitrine para o vocabulário do motor.
 *
 * Atenção ao homônimo: no cadastro do psicólogo, "modalidade de atendimento"
 * quer dizer online/presencial — outro eixo, que não entra aqui.
 */
export function normalizarModalidade(valor: string | undefined): ModalidadeAtendimento | null {
  switch (valor?.trim().toUpperCase()) {
    case 'SOCIAL':
    case 'CASAL_SOCIAL':
    case 'FAMILIA_SOCIAL':
    case 'ACESSIVEL_SOCIAL':
      return 'ACESSIVEL_SOCIAL';
    case 'PARTICULAR':
    case 'CASAL_PARTICULAR':
    case 'FAMILIA_PARTICULAR':
      return 'PARTICULAR';
    case 'AVALIACAO_PSICOLOGICA':
      return 'AVALIACAO_PSICOLOGICA';
    default:
      return null;
  }
}

