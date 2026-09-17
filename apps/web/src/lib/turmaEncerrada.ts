/**
 * Encerramento de turma.
 *
 * A clínica atende com os alunos das pós-graduações da Viver Mais em curso.
 * Quando a gestão encerra uma turma, os psicólogos dela saem do rodízio e da
 * vitrine na hora — sem ninguém precisar pausar um por um — e voltam se a turma
 * for reaberta.
 *
 * Módulo sem dependência de servidor: o rodízio, a vitrine pública e o card da
 * gestão precisam responder "está fora?" pelo mesmo critério, ou a tela
 * contradiz a distribuição.
 */

/** Turmas em curso, as únicas oferecidas em cadastro novo. */
export const TURMAS_ATIVAS: readonly string[] = ['24A', '24B', '25A', '25B', '26A', '26B'];

/** O que o cadastro carrega quando a turma dele foi encerrada. */
export interface TurmaEncerrada {
  turma: string;
  /** Data do encerramento, `AAAA-MM-DD`. */
  encerradaEm: string;
}

/** Turma encerrada: fora do rodízio e da vitrine. */
export function desligadoPorTurma(encerramento: TurmaEncerrada | undefined): boolean {
  return Boolean(encerramento);
}

/** `AAAA-MM-DD` ou ISO → `DD/MM/AAAA`, sem passar por fuso. */
export function formatarDataCurta(valor: string): string {
  const [ano, mes, dia] = valor.slice(0, 10).split('-');
  return `${dia}/${mes}/${ano}`;
}

/** Hoje em Brasília, `AAAA-MM-DD`. Brasília não tem horário de verão desde 2019. */
export function hojeEmBrasilia(agora: Date = new Date()): string {
  return new Date(agora.getTime() - 3 * 60 * 60 * 1000).toISOString().slice(0, 10);
}
