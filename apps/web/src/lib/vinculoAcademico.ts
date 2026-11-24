import { opcoesDosCursos, type CursoPos, type OpcoesAtendimentoDaPos } from '@/components/forms/opcoesPsicologo';
import { normalizarIdentidadeTurma } from './turmaEncerrada';
import {
  dataDeSaida,
  diasEntre,
  situacaoDaTurma,
  type PrazoSaidaTurma,
  type SituacaoTurma,
  type TurmaRegistro,
} from './turmasCiclo';

/**
 * Vínculos acadêmicos do psicólogo (especificação final, 1.04, 2.02, 3.2 e
 * 3.10).
 *
 * Cada pós-graduação do cadastro (a principal e a segunda) é um vínculo com
 * turma, aprovação própria e validade. Só os vínculos aprovados e válidos
 * somam permissões; uma pós pendente não libera serviço novo. Quando a turma
 * de um vínculo sai da vitrine, o psicólogo continua visível pelas permissões
 * da outra pós, se ela estiver aprovada e válida.
 *
 * Sem decisão gravada para o vínculo, vale a situação do cadastro — a regra
 * anterior, em que aprovar o cadastro aprovava as duas pós.
 */

export type PapelVinculo = 'PRINCIPAL' | 'SEGUNDA';
export type StatusVinculo = 'PENDENTE' | 'APROVADO' | 'RECUSADO';

export interface DecisaoVinculo {
  /** Pós a que a decisão se refere: trocar a pós descarta a decisão. */
  posGraduacao: string;
  status: StatusVinculo;
  decididoEm: string;
  decididoPorUsuarioRef?: string;
  decididoPorNome?: string;
  motivo?: string;
  /** Validade definida pela Gestão, `AAAA-MM-DD`. Ausente = sem data-limite própria. */
  validoAte?: string;
}

export interface EventoVinculo extends DecisaoVinculo {
  papel: PapelVinculo;
  /** Turma alterada pela Gestão neste evento, quando for o caso. */
  turma?: string;
}

export type DecisoesVinculos = Partial<Record<PapelVinculo, DecisaoVinculo>> & {
  /** Todas as decisões e trocas de turma, da mais antiga à mais recente. */
  historico?: readonly EventoVinculo[];
};

export interface CadastroComVinculos {
  status: string;
  posGraduacaoViverMais?: string;
  turmaViverMais?: string;
  segundaPosGraduacao?: string;
  segundaTurmaViverMais?: string;
  vinculosAcademicos?: DecisoesVinculos;
}

export interface VinculoAcademico {
  papel: PapelVinculo;
  posGraduacao: string;
  turma?: string;
  status: StatusVinculo;
  /** A decisão gravada, quando existe para esta pós. */
  decisao?: DecisaoVinculo;
}

export type MotivoVinculoInvalido = 'NAO_APROVADO' | 'TURMA_ENCERRADA' | 'VALIDADE_VENCIDA';

export interface SituacaoVinculo extends VinculoAcademico {
  situacaoTurma?: SituacaoTurma;
  encerradaEm?: string;
  saidaEm?: string;
  diasRestantes?: number;
  valido: boolean;
  motivoInvalido?: MotivoVinculoInvalido;
}

export interface SituacaoAcademica {
  vinculos: SituacaoVinculo[];
  /** Cadastro aprovado sem nenhum vínculo válido: fora da vitrine e do rodízio. */
  desligado: boolean;
  /** Cursos dos vínculos aprovados e válidos — a origem das permissões. */
  cursosValidos: string[];
  /** Vínculo válido em prazo de saída mais próximo de vencer, para a contagem. */
  emSaida?: SituacaoVinculo;
}

export const ROTULO_STATUS_VINCULO: Record<StatusVinculo, string> = {
  PENDENTE: 'Aguardando aprovação',
  APROVADO: 'Aprovado',
  RECUSADO: 'Recusado',
};

function statusDoCadastro(status: string): StatusVinculo {
  if (status === 'APROVADO') return 'APROVADO';
  return status === 'RECUSADO' ? 'RECUSADO' : 'PENDENTE';
}

export function lerDecisoesVinculos(valor: unknown): DecisoesVinculos | undefined {
  let bruto = valor;
  if (typeof valor === 'string') {
    try { bruto = JSON.parse(valor) as unknown; } catch { return undefined; }
  }
  if (!bruto || typeof bruto !== 'object') return undefined;
  const decisoes: DecisoesVinculos = {};
  for (const papel of ['PRINCIPAL', 'SEGUNDA'] as const) {
    const item = (bruto as Record<string, unknown>)[papel] as Record<string, unknown> | undefined;
    if (!item || typeof item.posGraduacao !== 'string' || typeof item.decididoEm !== 'string') continue;
    if (item.status !== 'PENDENTE' && item.status !== 'APROVADO' && item.status !== 'RECUSADO') continue;
    decisoes[papel] = {
      posGraduacao: item.posGraduacao,
      status: item.status,
      decididoEm: item.decididoEm,
      ...(typeof item.decididoPorUsuarioRef === 'string' ? { decididoPorUsuarioRef: item.decididoPorUsuarioRef } : {}),
      ...(typeof item.decididoPorNome === 'string' ? { decididoPorNome: item.decididoPorNome } : {}),
      ...(typeof item.motivo === 'string' && item.motivo ? { motivo: item.motivo } : {}),
      ...(typeof item.validoAte === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(item.validoAte) ? { validoAte: item.validoAte } : {}),
    };
  }
  const historico = (bruto as { historico?: unknown }).historico;
  if (Array.isArray(historico)) {
    decisoes.historico = historico.filter((item): item is EventoVinculo =>
      Boolean(item) && typeof (item as EventoVinculo).decididoEm === 'string'
      && ((item as EventoVinculo).papel === 'PRINCIPAL' || (item as EventoVinculo).papel === 'SEGUNDA'));
  }
  return Object.keys(decisoes).length ? decisoes : undefined;
}

export function vinculosDoCadastro(cadastro: CadastroComVinculos): VinculoAcademico[] {
  const vinculos: VinculoAcademico[] = [];
  const montar = (papel: PapelVinculo, posGraduacao: string | undefined, turma: string | undefined) => {
    const pos = posGraduacao?.trim();
    if (!pos) return;
    const decisao = cadastro.vinculosAcademicos?.[papel];
    const vale = decisao && decisao.posGraduacao === pos ? decisao : undefined;
    vinculos.push({
      papel,
      posGraduacao: pos,
      ...(turma?.trim() ? { turma: turma.trim().toUpperCase() } : {}),
      status: vale?.status ?? statusDoCadastro(cadastro.status),
      ...(vale ? { decisao: vale } : {}),
    });
  };
  montar('PRINCIPAL', cadastro.posGraduacaoViverMais, cadastro.turmaViverMais);
  montar('SEGUNDA', cadastro.segundaPosGraduacao, cadastro.segundaTurmaViverMais);
  return vinculos;
}

function turmaDoVinculo(vinculo: VinculoAcademico, turmas: readonly TurmaRegistro[]): TurmaRegistro | undefined {
  if (!vinculo.turma) return undefined;
  const alvo = normalizarIdentidadeTurma({ turma: vinculo.turma, posGraduacao: vinculo.posGraduacao });
  return turmas.find((turma) => {
    const identidade = normalizarIdentidadeTurma({ turma: turma.codigo, posGraduacao: turma.posGraduacao });
    return identidade.turma === alvo.turma && identidade.posGraduacao === alvo.posGraduacao;
  });
}

export function situacaoAcademica(
  cadastro: CadastroComVinculos,
  turmas: readonly TurmaRegistro[],
  prazo: PrazoSaidaTurma,
  hoje: string
): SituacaoAcademica {
  const vinculos = vinculosDoCadastro(cadastro).map((vinculo): SituacaoVinculo => {
    const turma = turmaDoVinculo(vinculo, turmas);
    const situacaoTurma = turma ? situacaoDaTurma(turma, prazo, hoje) : undefined;
    const saidaEm = turma ? dataDeSaida(turma, prazo) : undefined;
    const validoAte = vinculo.decisao?.validoAte;
    const motivoInvalido: MotivoVinculoInvalido | undefined = vinculo.status !== 'APROVADO'
      ? 'NAO_APROVADO'
      : situacaoTurma === 'DESLIGADA'
        ? 'TURMA_ENCERRADA'
        : validoAte && hoje > validoAte ? 'VALIDADE_VENCIDA' : undefined;
    return {
      ...vinculo,
      ...(situacaoTurma ? { situacaoTurma } : {}),
      ...(turma?.encerradaEm ? { encerradaEm: turma.encerradaEm } : {}),
      ...(saidaEm ? { saidaEm, diasRestantes: diasEntre(hoje, saidaEm) } : {}),
      valido: !motivoInvalido,
      ...(motivoInvalido ? { motivoInvalido } : {}),
    };
  });
  const validos = vinculos.filter((vinculo) => vinculo.valido);
  const emSaida = validos
    .filter((vinculo) => vinculo.situacaoTurma === 'EM_SAIDA' && vinculo.saidaEm)
    .sort((a, b) => a.saidaEm!.localeCompare(b.saidaEm!))[0];
  return {
    vinculos,
    // Cadastro em análise ou recusado já está fora por conta própria; aqui só
    // o aprovado que perdeu todos os vínculos (turma, validade ou decisão).
    desligado: cadastro.status === 'APROVADO' && vinculos.length > 0 && validos.length === 0,
    cursosValidos: [...new Set(validos.map((vinculo) => vinculo.posGraduacao))],
    ...(emSaida ? { emSaida } : {}),
  };
}

/** Permissões efetivas: só as dos vínculos aprovados e válidos (2.02). */
export function permissoesEfetivas(situacao: SituacaoAcademica, catalogo: readonly CursoPos[]): OpcoesAtendimentoDaPos | null {
  return opcoesDosCursos(situacao.cursosValidos, catalogo);
}

/** Formatos permitidos pelos cursos válidos. Vazio = sem restrição. */
export function formatosPermitidos(cursos: readonly string[], catalogo: readonly CursoPos[]): ('ONLINE' | 'PRESENCIAL')[] {
  const restricoes = cursos
    .map((nome) => catalogo.find((curso) => curso.nome === nome))
    .filter((curso): curso is CursoPos => Boolean(curso));
  // Um curso sem restrição libera os dois formatos.
  if (!restricoes.length || restricoes.some((curso) => !curso.formatos.length)) return [];
  return [...new Set(restricoes.flatMap((curso) => curso.formatos))];
}

/** Quais cursos válidos autorizam cada serviço — a origem da autorização (2.02). */
export function origemDosServicos(
  servicos: readonly string[],
  situacao: SituacaoAcademica,
  catalogo: readonly CursoPos[]
): Record<string, string[]> {
  return Object.fromEntries(servicos.map((servico) => [
    servico,
    situacao.cursosValidos.filter((nome) => catalogo.find((curso) => curso.nome === nome)?.servicos.includes(servico)),
  ]));
}
