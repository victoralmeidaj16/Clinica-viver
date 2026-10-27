import { TURMAS_ATIVAS } from '@/lib/turmaEncerrada';
import { TURNOS_ATENDIMENTO, rotuloTurnoPreferencia } from '@/lib/turnos';

/**
 * Vocabulário do cadastro de psicólogo, em um lugar só.
 *
 * Formulário de credenciamento, perfil do próprio profissional e telas da
 * gestão listavam opções cada um com sua cópia. Quando as cópias divergiam, o
 * que a pessoa marcou no cadastro (`Casais`, `LGBT`, `Grupo`) simplesmente não
 * aparecia marcado na edição — e salvar de novo apagava o valor, porque a tela
 * só sabia devolver o que ela mesma sabia desenhar.
 */

export interface Opcao {
  value: string;
  label: string;
}

export const TURNOS_PSICOLOGO: readonly Opcao[] = TURNOS_ATENDIMENTO;

export const SERVICOS_PRESTADOS: readonly string[] = [
  'Atendimento Psicológico',
  'Avaliação Psicológica',
  'Orientação Vocacional e Profissional',
  'Orientação Parental',
  'Orientação Vocacional',
  'Orientação Profissional',
];

export const TEMPOS_ATENDIMENTO_POS: readonly number[] = [50, 90];

const POS_COM_OPCOES_AMPLAS_DE_ATENDIMENTO: readonly string[] = [
  'Programa de Estudos e Pós-graduação em Psicanálise',
  'Formação e Pós-graduação em Psicodrama',
  'Formação e Pós-graduação em Psicologia Existencialista Clínica',
  'Formação e Pós-graduação em Psicologia Junguiana Clínica',
  'Pós-graduação em Psicoterapia da Sexualidade',
  'Formação e Pós-graduação em Terapia Cognitivo-Comportamental',
  'Pós-graduação em Terapias Cognitivo-Comportamentais de Terceira Geração',
  'Formação e Pós-graduação em Terapia Familiar Sistêmica',
  'Formação e Pós-graduação em Psicodrama Didata e Psicoterapeuta do Aluno - Nível II',
  'Formação e Pós-graduação em Psicodrama Didata Orientador e Supervisor - Nível III',
];

const POS_COM_OPCOES_RESTRITAS_DE_ATENDIMENTO: readonly string[] = [
  'Pós-graduação em Psicologia Perinatal e Parentalidade',
  'Pós-graduação em Psicoterapia de Casal e Família',
  'Pós-graduação em Psicoterapia Infantil e de Adolescentes',
];

const POS_COM_OPCOES_DE_AVALIACAO: readonly string[] = [
  'Pós-graduação em Avaliação Psicológica',
  'Pós-graduação em Neuropsicologia Clínica',
];

const SERVICOS_POS_AMPLAS: readonly string[] = [
  'Atendimento Psicológico',
  'Orientação Vocacional e Profissional',
  'Orientação Parental',
  'Orientação Vocacional',
  'Orientação Profissional',
];

const SERVICOS_POS_RESTRITAS: readonly string[] = [
  'Atendimento Psicológico',
  'Orientação Parental',
  'Orientação Vocacional e Profissional',
];

const SERVICOS_POS_AVALIACAO: readonly string[] = ['Avaliação Psicológica'];

const PUBLICO_POS_AVALIACAO: readonly string[] = [
  'Adolescente',
  'Criança',
  'Idoso',
  'Homens',
  'Mulheres',
];

export interface OpcoesAtendimentoDaPos {
  tempos: readonly number[];
  servicos: readonly string[];
  publico: readonly string[];
}

export const PUBLICO_ALVO: readonly string[] = [
  'Criança',
  'Adolescente',
  'Homens',
  'Idoso',
  'Casais',
  'Família',
  'Mulheres',
  'Grupo',
  'Outro',
];

/**
 * Regras de atendimento supervisionado por pós-graduação.
 *
 * Psicologia Perinatal e Parentalidade pertence ao grupo restrito. Quando há
 * uma segunda pós do grupo amplo, a configuração ampla tem precedência.
 */
export function opcoesAtendimentoDaPos(
  posGraduacao?: string,
  segundaPosGraduacao?: string
): OpcoesAtendimentoDaPos | null {
  const pos = [posGraduacao, segundaPosGraduacao].filter((curso): curso is string => Boolean(curso));
  if (pos.some((curso) => POS_COM_OPCOES_AMPLAS_DE_ATENDIMENTO.includes(curso))) {
    return { tempos: TEMPOS_ATENDIMENTO_POS, servicos: SERVICOS_POS_AMPLAS, publico: PUBLICO_ALVO };
  }
  if (pos.some((curso) => POS_COM_OPCOES_RESTRITAS_DE_ATENDIMENTO.includes(curso))) {
    return { tempos: TEMPOS_ATENDIMENTO_POS, servicos: SERVICOS_POS_RESTRITAS, publico: PUBLICO_ALVO };
  }
  if (pos.some((curso) => POS_COM_OPCOES_DE_AVALIACAO.includes(curso))) {
    return { tempos: TEMPOS_ATENDIMENTO_POS, servicos: SERVICOS_POS_AVALIACAO, publico: PUBLICO_POS_AVALIACAO };
  }
  return null;
}

export const MODALIDADES_ATENDIMENTO: readonly Opcao[] = [
  { value: 'ONLINE', label: 'Online' },
  { value: 'PRESENCIAL', label: 'Presencial' },
  { value: 'AMBOS', label: 'Ambos' },
];

export const TIPOS_ATENDIMENTO: readonly Opcao[] = [
  { value: 'PARTICULAR', label: 'Atendimento Particular' },
  { value: 'SOCIAL', label: 'Atendimento Social' },
  { value: 'AMBOS', label: 'Ambos' },
];

/** Só turmas em curso: a clínica atende com os alunos das pós que estão acontecendo. */
export const TURMAS_VIVER_MAIS: readonly string[] = TURMAS_ATIVAS;

export const POS_GRADUACOES_VIVER_MAIS: readonly string[] = [
  'Pós-graduação em Avaliação Psicológica',
  'Programa de Estudos e Pós-graduação em Psicanálise',
  'Formação e Pós-graduação em Psicodrama',
  'Formação e Pós-graduação em Psicologia Existencialista Clínica',
  'Formação e Pós-graduação em Psicologia Junguiana Clínica',
  'Pós-graduação em Psicologia Perinatal e Parentalidade',
  'Pós-graduação em Psicoterapia de Casal e Família',
  'Pós-graduação em Psicoterapia da Sexualidade',
  'Pós-graduação em Psicoterapia Infantil e de Adolescentes',
  'Pós-graduação em Neuropsicologia Clínica',
  'Formação e Pós-graduação em Terapia Cognitivo-Comportamental',
  'Pós-graduação em Terapias Cognitivo-Comportamentais de Terceira Geração',
  'Formação e Pós-graduação em Terapia Familiar Sistêmica',
  'Formação e Pós-graduação em Psicodrama Didata e Psicoterapeuta do Aluno - Nível II',
  'Formação e Pós-graduação em Psicodrama Didata Orientador e Supervisor - Nível III',
];

/** A segunda pós também precisa ser um curso ofertado pela Viver Mais. */
export const SEGUNDAS_POS_GRADUACOES = POS_GRADUACOES_VIVER_MAIS;

export function rotuloTurno(valor: string): string {
  return rotuloTurnoPreferencia(valor);
}

export function rotuloModalidade(valor?: string): string {
  if (!valor) return '—';
  return MODALIDADES_ATENDIMENTO.find((m) => m.value === valor)?.label ?? valor;
}

export function rotuloTipoAtendimento(valor?: string): string {
  if (valor === 'PARTICULAR') return 'Somente Particular';
  if (valor === 'SOCIAL') return 'Somente Social';
  return 'Particular & Social';
}

/**
 * Junta o que a tela oferece com o que o cadastro já tem.
 *
 * Registros antigos guardam rótulos que saíram da lista (`Psicoterapia de
 * Casal`, `Mulher`). Sem isso eles somem da edição e o primeiro "salvar"
 * apagaria a informação sem ninguém perceber.
 */
export function comValoresRegistrados(
  opcoes: readonly string[],
  selecionados: readonly string[] | undefined
): string[] {
  const extras = (selecionados ?? []).filter((item) => !opcoes.includes(item));
  return [...opcoes, ...extras];
}
