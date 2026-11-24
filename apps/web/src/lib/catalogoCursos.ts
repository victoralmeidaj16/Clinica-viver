import {
  CATALOGO_CURSOS_PADRAO,
  PUBLICO_ALVO,
  SERVICOS_PRESTADOS,
  TEMPOS_ATENDIMENTO_POS,
  type CursoPos,
} from '@/components/forms/opcoesPsicologo';

/**
 * Catálogo de pós-graduações administrado pela Gestão (especificação final,
 * 1.01 e 2.01).
 *
 * O padrão do código (os 17 cursos do § 14) continua sendo a base. A Gestão
 * grava ajustes — um curso alterado ou um curso novo — e o catálogo efetivo é
 * o padrão com esses ajustes por cima. Alterar um curso não altera os outros.
 *
 * O nome identifica o curso: é ele que está gravado no cadastro de cada
 * psicólogo. Por isso não é renomeável; para trocar o nome, cria-se o curso
 * novo e desativa-se o antigo, e quem já está vinculado continua com as
 * permissões do antigo.
 */

export const FORMATOS_CURSO = ['ONLINE', 'PRESENCIAL'] as const;

function lista(valor: unknown): string[] {
  return Array.isArray(valor) ? valor.filter((item): item is string => typeof item === 'string') : [];
}

/** Lê o que foi gravado, descartando o que não tiver a forma mínima. */
export function lerAjustesCatalogo(valor: unknown): CursoPos[] {
  if (!Array.isArray(valor)) return [];
  return valor.flatMap((item): CursoPos[] => {
    if (!item || typeof item !== 'object') return [];
    const curso = item as Record<string, unknown>;
    if (typeof curso.nome !== 'string' || !curso.nome.trim()) return [];
    return [{
      nome: curso.nome.trim(),
      servicos: lista(curso.servicos),
      publicos: lista(curso.publicos),
      tempos: Array.isArray(curso.tempos) ? curso.tempos.filter((tempo): tempo is number => tempo === 50 || tempo === 90) : [],
      duracaoVariavel: curso.duracaoVariavel === true,
      formatos: lista(curso.formatos).filter((formato): formato is 'ONLINE' | 'PRESENCIAL' =>
        (FORMATOS_CURSO as readonly string[]).includes(formato)),
      ativo: curso.ativo !== false,
    }];
  });
}

/** Padrão com os ajustes da Gestão por cima; cursos novos entram no fim. */
export function catalogoEfetivo(ajustesGravados: unknown): CursoPos[] {
  const ajustes = lerAjustesCatalogo(ajustesGravados);
  const porNome = new Map(ajustes.map((curso) => [curso.nome, curso]));
  const padrao = CATALOGO_CURSOS_PADRAO.map((curso) => porNome.get(curso.nome) ?? curso);
  const novos = ajustes.filter((curso) => !CATALOGO_CURSOS_PADRAO.some((item) => item.nome === curso.nome));
  return [...padrao, ...novos];
}

export type ValidacaoCurso = { ok: true; curso: CursoPos } | { ok: false; erro: string };

/**
 * Valida a edição ou criação de um curso. `existente` diz se é edição: o nome
 * vem do curso editado e não muda; na criação, não pode repetir outro curso.
 */
export function validarCurso(corpo: unknown, catalogo: readonly CursoPos[], existente?: CursoPos): ValidacaoCurso {
  if (!corpo || typeof corpo !== 'object') return { ok: false, erro: 'Envie os dados do curso.' };
  const fonte = corpo as Record<string, unknown>;
  const nome = existente?.nome ?? (typeof fonte.nome === 'string' ? fonte.nome.trim().replace(/\s+/g, ' ').slice(0, 255) : '');
  if (nome.length < 5) return { ok: false, erro: 'Informe o nome completo da pós-graduação.' };
  if (!existente && catalogo.some((curso) => curso.nome.toLocaleLowerCase('pt-BR') === nome.toLocaleLowerCase('pt-BR'))) {
    return { ok: false, erro: 'Já existe um curso com esse nome. Edite o existente.' };
  }

  const servicos = SERVICOS_PRESTADOS.filter((servico) => lista(fonte.servicos).includes(servico));
  if (!servicos.length) return { ok: false, erro: 'Selecione ao menos uma modalidade de atendimento.' };
  const publicos = PUBLICO_ALVO.filter((publico) => lista(fonte.publicos).includes(publico));
  if (!publicos.length) return { ok: false, erro: 'Selecione ao menos um público.' };

  const duracaoVariavel = fonte.duracaoVariavel === true;
  const tempos = TEMPOS_ATENDIMENTO_POS.filter((tempo) => Array.isArray(fonte.tempos) && fonte.tempos.includes(tempo));
  if (!duracaoVariavel && !tempos.length) {
    return { ok: false, erro: 'Selecione 50 minutos, 1h30 ou a duração variável.' };
  }
  const formatos = FORMATOS_CURSO.filter((formato) => lista(fonte.formatos).includes(formato));

  return {
    ok: true,
    curso: {
      nome,
      servicos,
      publicos,
      tempos: duracaoVariavel ? [] : tempos,
      duracaoVariavel,
      formatos,
      ativo: fonte.ativo !== false,
    },
  };
}

/** Grava o curso nos ajustes, substituindo o ajuste anterior do mesmo nome. */
export function comCursoAjustado(ajustesGravados: unknown, curso: CursoPos): CursoPos[] {
  const ajustes = lerAjustesCatalogo(ajustesGravados).filter((item) => item.nome !== curso.nome);
  return [...ajustes, curso];
}

/** Nomes dos cursos que mudaram entre duas versões dos ajustes, para o histórico. */
export function cursosAlterados(anterior: unknown, novo: unknown): string[] {
  const antes = new Map(lerAjustesCatalogo(anterior).map((curso) => [curso.nome, JSON.stringify(curso)]));
  return lerAjustesCatalogo(novo)
    .filter((curso) => antes.get(curso.nome) !== JSON.stringify(curso))
    .map((curso) => curso.nome);
}
