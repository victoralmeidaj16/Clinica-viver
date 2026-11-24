import { normalizarTurnosPreferencia, rotuloTurnoPreferencia } from './turnos';

/**
 * Preferências do pedido e a origem delas (especificação final, 4.04).
 *
 * O que chegou do site fica congelado em `preferenciasOriginais` no momento da
 * entrada. Uma alteração posterior muda os campos vivos do pedido — que são os
 * que o rodízio lê — e acrescenta uma linha em `alteracoesPreferencias` com o
 * antes e o depois de cada campo, quem alterou e quando. A original nunca é
 * reescrita.
 */

export const CAMPOS_PREFERENCIA = [
  'servico',
  'servicoKey',
  'modalidade',
  'formatoAtendimento',
  'turno',
  'paraQuemE',
  'preferenciaGeneroPsicologo',
  'abordagemDesejada',
  'duracaoSessaoMinutos',
  'especificarNecessidades',
  'necessidadesPaciente',
  'necessidadesOutro',
  'opcaoAvaliacaoPsicologica',
  'possuiConvenio',
  'convenioSelecionado',
] as const;

export type CampoPreferencia = (typeof CAMPOS_PREFERENCIA)[number];

/** Campos que a Gestão pode corrigir. Serviço e convênio têm fluxos próprios. */
export const CAMPOS_PREFERENCIA_EDITAVEIS = [
  'modalidade',
  'formatoAtendimento',
  'turno',
  'paraQuemE',
  'preferenciaGeneroPsicologo',
  'abordagemDesejada',
  'duracaoSessaoMinutos',
  'necessidadesPaciente',
  'necessidadesOutro',
] as const satisfies readonly CampoPreferencia[];

export type CampoPreferenciaEditavel = (typeof CAMPOS_PREFERENCIA_EDITAVEIS)[number];

export type ValorPreferencia = string | number | boolean | readonly string[] | undefined;

export type PreferenciasSolicitacao = Partial<Record<CampoPreferencia, ValorPreferencia>> & {
  /** Profissional escolhido no site, quando houve escolha direta (4.05). */
  psicologoIndicadoId?: string;
  /** Quando a fotografia foi tirada. */
  registradoEm: string;
  /**
   * `SITE`/`CADASTRO_MANUAL`: gravada na entrada. `RECONSTRUIDA`: pedido
   * anterior a este registro, fotografado na primeira alteração — como não
   * havia edição de preferências antes disso, os valores eram os originais.
   */
  origem: 'SITE' | 'CADASTRO_MANUAL' | 'RECONSTRUIDA';
};

export interface DiferencaPreferencia {
  campo: CampoPreferencia;
  antes: ValorPreferencia;
  depois: ValorPreferencia;
}

export interface AlteracaoPreferencias {
  em: string;
  porUsuarioRef: string;
  porNome?: string;
  motivo?: string;
  campos: readonly DiferencaPreferencia[];
}

export const ROTULO_CAMPO_PREFERENCIA: Record<CampoPreferencia, string> = {
  servico: 'Serviço',
  servicoKey: 'Código do serviço',
  modalidade: 'Faixa de valor',
  formatoAtendimento: 'Formato',
  turno: 'Período de preferência',
  paraQuemE: 'Público',
  preferenciaGeneroPsicologo: 'Gênero do profissional',
  abordagemDesejada: 'Abordagem',
  duracaoSessaoMinutos: 'Duração da sessão',
  especificarNecessidades: 'Informou demandas',
  necessidadesPaciente: 'Demandas',
  necessidadesOutro: 'Outra demanda',
  opcaoAvaliacaoPsicologica: 'Opção de avaliação',
  possuiConvenio: 'Possui convênio',
  convenioSelecionado: 'Convênio informado',
};

type FonteDePreferencias = Partial<Record<CampoPreferencia, unknown>>;

function valorDe(campo: CampoPreferencia, fonte: FonteDePreferencias): ValorPreferencia {
  const valor = fonte[campo];
  if (valor === null || valor === undefined || valor === '') return undefined;
  if (Array.isArray(valor)) return valor.filter((item): item is string => typeof item === 'string');
  if (typeof valor === 'string' || typeof valor === 'number' || typeof valor === 'boolean') return valor;
  return undefined;
}

/** Fotografia dos campos de preferência de um pedido. */
export function extrairPreferencias(
  fonte: FonteDePreferencias,
  origem: PreferenciasSolicitacao['origem'],
  registradoEm: string,
  psicologoIndicadoId?: string,
): PreferenciasSolicitacao {
  const preferencias: PreferenciasSolicitacao = { registradoEm, origem };
  for (const campo of CAMPOS_PREFERENCIA) {
    const valor = valorDe(campo, fonte);
    if (valor !== undefined) preferencias[campo] = valor;
  }
  if (psicologoIndicadoId) preferencias.psicologoIndicadoId = psicologoIndicadoId;
  return preferencias;
}

function comparavel(valor: ValorPreferencia): string {
  if (valor === undefined) return '';
  return Array.isArray(valor) ? JSON.stringify([...valor].sort()) : String(valor);
}

/** Campos que mudaram entre duas leituras, na ordem canônica. */
export function diferencasPreferencias(
  antes: FonteDePreferencias,
  depois: FonteDePreferencias,
  campos: readonly CampoPreferencia[] = CAMPOS_PREFERENCIA,
): DiferencaPreferencia[] {
  return campos.flatMap((campo) => {
    const a = valorDe(campo, antes);
    const d = valorDe(campo, depois);
    return comparavel(a) === comparavel(d) ? [] : [{ campo, antes: a, depois: d }];
  });
}

const ROTULO_FORMATO: Record<string, string> = {
  ONLINE: 'On-line',
  PRESENCIAL: 'Presencial',
  INDIFERENTE: 'Indiferente',
};

const ROTULO_GENERO: Record<string, string> = {
  MASCULINO: 'Masculino',
  FEMININO: 'Feminino',
  SEM_PREFERENCIA: 'Sem preferência',
};

/** Valor como a Gestão e o psicólogo leem. */
export function formatarValorPreferencia(campo: CampoPreferencia, valor: ValorPreferencia): string {
  if (valor === undefined) return 'Não informado';
  if (campo === 'turno') return rotuloTurnoPreferencia(String(valor));
  if (campo === 'formatoAtendimento') return ROTULO_FORMATO[String(valor)] ?? String(valor);
  if (campo === 'preferenciaGeneroPsicologo') return ROTULO_GENERO[String(valor)] ?? String(valor);
  if (campo === 'duracaoSessaoMinutos') return Number(valor) === 90 ? '1h30' : `${valor} minutos`;
  if (typeof valor === 'boolean') return valor ? 'Sim' : 'Não';
  if (Array.isArray(valor)) return valor.length ? valor.join(', ') : 'Nenhuma';
  return String(valor);
}

function texto(valor: unknown, maximo: number): string | undefined {
  if (typeof valor !== 'string') return undefined;
  const limpo = valor.trim().replace(/\s+/g, ' ').slice(0, maximo);
  return limpo || undefined;
}

export type ValidacaoPreferencias =
  | { ok: true; valores: Partial<Record<CampoPreferenciaEditavel, ValorPreferencia>>; motivo?: string }
  | { ok: false; erro: string };

/**
 * Valida só os campos editáveis presentes no corpo. Campo ausente não é
 * alterado; string vazia apaga o valor (quando o campo admite ausência).
 */
export function validarAlteracaoPreferencias(corpo: Record<string, unknown>): ValidacaoPreferencias {
  const bruto = (corpo.preferencias && typeof corpo.preferencias === 'object'
    ? corpo.preferencias
    : {}) as Record<string, unknown>;
  const valores: Partial<Record<CampoPreferenciaEditavel, ValorPreferencia>> = {};

  if ('turno' in bruto) {
    const turnos = normalizarTurnosPreferencia(bruto.turno);
    if (!turnos.length) return { ok: false, erro: 'Selecione pelo menos um período: manhã, tarde ou noite.' };
    valores.turno = turnos.join(',');
  }
  if ('formatoAtendimento' in bruto) {
    const formato = texto(bruto.formatoAtendimento, 24)?.toUpperCase();
    if (formato && !(formato in ROTULO_FORMATO)) return { ok: false, erro: 'Formato de atendimento inválido.' };
    valores.formatoAtendimento = formato;
  }
  if ('preferenciaGeneroPsicologo' in bruto) {
    const genero = texto(bruto.preferenciaGeneroPsicologo, 24)?.toUpperCase();
    if (genero && !(genero in ROTULO_GENERO)) return { ok: false, erro: 'Preferência de gênero inválida.' };
    valores.preferenciaGeneroPsicologo = genero === 'SEM_PREFERENCIA' ? undefined : genero;
  }
  if ('duracaoSessaoMinutos' in bruto) {
    const duracao = bruto.duracaoSessaoMinutos === '' || bruto.duracaoSessaoMinutos === null
      ? undefined
      : Number(bruto.duracaoSessaoMinutos);
    if (duracao !== undefined && duracao !== 50 && duracao !== 90) {
      return { ok: false, erro: 'A duração deve ser de 50 minutos ou 1h30.' };
    }
    valores.duracaoSessaoMinutos = duracao;
  }
  if ('modalidade' in bruto) {
    const modalidade = texto(bruto.modalidade, 40)?.toUpperCase();
    if (!modalidade) return { ok: false, erro: 'Informe a faixa de valor.' };
    valores.modalidade = modalidade;
  }
  if ('paraQuemE' in bruto) valores.paraQuemE = texto(bruto.paraQuemE, 160);
  if ('abordagemDesejada' in bruto) valores.abordagemDesejada = texto(bruto.abordagemDesejada, 120);
  if ('necessidadesOutro' in bruto) valores.necessidadesOutro = texto(bruto.necessidadesOutro, 300);
  if ('necessidadesPaciente' in bruto) {
    if (!Array.isArray(bruto.necessidadesPaciente)) return { ok: false, erro: 'Demandas inválidas.' };
    valores.necessidadesPaciente = bruto.necessidadesPaciente
      .filter((item): item is string => typeof item === 'string')
      .map((item) => item.trim().slice(0, 120))
      .filter(Boolean)
      .slice(0, 20);
  }

  if (!Object.keys(valores).length) return { ok: false, erro: 'Nenhuma preferência foi informada para alterar.' };
  return { ok: true, valores, motivo: texto(corpo.motivo, 500) };
}
