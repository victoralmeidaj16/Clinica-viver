import 'server-only';

import { ApplicationError, failure } from '@/server/application/http';

/**
 * Erros esperados do contexto acadêmico são sempre ApplicationError. Qualquer
 * outro (banco fora do ar, driver, bug) é registrado no servidor e devolvido
 * como mensagem genérica, sem expor host, porta ou detalhe interno ao aluno.
 */
export function academicFailure(error: unknown) {
  if (error instanceof ApplicationError) return failure(error);
  console.error('[academico] erro inesperado', error);
  return failure(new ApplicationError('INTERNAL_ERROR', 'Não foi possível concluir agora. Tente novamente em instantes.', 500));
}
