import { PRAZO_SAIDA_PADRAO, somarPrazo } from './turmasCiclo';

export { formatarDataCurta } from './turmasCiclo';

/**
 * Encerramento de turma.
 *
 * A clínica atende com os alunos das pós-graduações da Viver Mais em curso.
 * Quando a gestão encerra uma turma, os psicólogos dela continuam no rodízio e
 * na vitrine até o fim do prazo de saída (padrão de três meses, 1.02) — sem
 * ninguém precisar pausar um por um — e voltam se a turma for reaberta.
 *
 * Módulo sem dependência de servidor: o rodízio, a vitrine pública e o card da
 * gestão precisam responder "está fora?" pelo mesmo critério, ou a tela
 * contradiz a distribuição.
 */

/** Turmas em curso, as únicas oferecidas em cadastro novo. */
export const TURMAS_ATIVAS: readonly string[] = ['24A', '24B', '25A', '25B', '26A', '26B'];

/** O que o cadastro carrega quando a turma dele foi encerrada. */
export interface IdentidadeTurma {
  turma: string;
  posGraduacao: string;
}

export interface TurmaEncerrada extends IdentidadeTurma {
  /** Data do encerramento, `AAAA-MM-DD`. */
  encerradaEm: string;
  /** Data prevista para sair da vitrine (1.02). Ausente: encerramento mais o prazo padrão de três meses. */
  saidaEm?: string;
  /** Retirada interrompida pela Gestão (1.05): continua na vitrine. */
  retiradaInterrompida?: boolean;
}

export function normalizarIdentidadeTurma(identidade: IdentidadeTurma): IdentidadeTurma {
  return {
    turma: identidade.turma.trim().toUpperCase(),
    posGraduacao: identidade.posGraduacao.trim(),
  };
}

/** Serializa o par sem depender de um separador que possa existir no nome do curso. */
export function chaveTurma(identidade: IdentidadeTurma): string {
  const normalizada = normalizarIdentidadeTurma(identidade);
  return JSON.stringify([normalizada.posGraduacao, normalizada.turma]);
}

/**
 * O vínculo desta turma já saiu da vitrine? Só depois da data de saída
 * (1.02–1.04) e nunca com a retirada interrompida. Registro sem data de saída
 * usa o prazo padrão a partir do encerramento: todo encerramento tem prazo.
 */
export function desligadoPorTurma(encerramento: TurmaEncerrada | undefined, hoje: string = hojeEmBrasilia()): boolean {
  if (!encerramento) return false;
  if (encerramento.retiradaInterrompida) return false;
  return hoje >= (encerramento.saidaEm ?? somarPrazo(encerramento.encerradaEm, PRAZO_SAIDA_PADRAO));
}

/**
 * Fora da vitrine e do rodízio pela situação acadêmica: todos os vínculos
 * aprovados perderam a validade. Com a situação derivada ausente (leitura sem
 * turmas), vale o encerramento da turma principal.
 */
export function foraPorVinculoAcademico(cadastro: {
  situacaoAcademica?: { desligado: boolean };
  turmaEncerrada?: TurmaEncerrada;
}): boolean {
  return cadastro.situacaoAcademica ? cadastro.situacaoAcademica.desligado : desligadoPorTurma(cadastro.turmaEncerrada);
}

/** Hoje em Brasília, `AAAA-MM-DD`. Brasília não tem horário de verão desde 2019. */
export function hojeEmBrasilia(agora: Date = new Date()): string {
  return new Date(agora.getTime() - 3 * 60 * 60 * 1000).toISOString().slice(0, 10);
}
