import 'server-only';

import type { CursoPos } from '@/components/forms/opcoesPsicologo';
import { catalogoEfetivo, comCursoAjustado, cursosAlterados, validarCurso } from '@/lib/catalogoCursos';
import type { AutorDaSessao } from './autorGestao';
import { gravarConfiguracaoGestao, lerConfiguracaoGestao, organizacaoPadrao } from './configuracaoGestao';
import { ApplicationError } from './http';

export const CHAVE_CATALOGO_CURSOS = 'catalogo_cursos';

/**
 * Catálogo efetivo de pós-graduações (1.01 e 2.01). Lido em todo cadastro,
 * edição de perfil e na vitrine; um cache curto evita duas consultas por
 * requisição pública. Toda gravação limpa o cache do processo.
 */
let cache: { organizacao: string; cursos: CursoPos[]; expira: number } | null = null;
const VALIDADE_CACHE_MS = 15_000;

export async function obterCatalogoCursos(organizationId: string = organizacaoPadrao()): Promise<CursoPos[]> {
  if (cache && cache.organizacao === organizationId && cache.expira > Date.now()) return cache.cursos;
  const lida = await lerConfiguracaoGestao<unknown>(organizationId, CHAVE_CATALOGO_CURSOS);
  const cursos = catalogoEfetivo(lida.valor);
  cache = { organizacao: organizationId, cursos, expira: Date.now() + VALIDADE_CACHE_MS };
  return cursos;
}

export interface AlteracaoCatalogo {
  alteradoEm: string;
  alteradoPorNome?: string;
  cursos: string[];
}

export interface CatalogoParaGestao {
  cursos: CursoPos[];
  /** Cursos com ajuste gravado pela Gestão (os demais seguem o padrão do § 14). */
  ajustados: string[];
  historico: AlteracaoCatalogo[];
  editavel: boolean;
}

export async function obterCatalogoParaGestao(organizationId: string): Promise<CatalogoParaGestao> {
  const lida = await lerConfiguracaoGestao<unknown>(organizationId, CHAVE_CATALOGO_CURSOS);
  return {
    cursos: catalogoEfetivo(lida.valor),
    ajustados: Array.isArray(lida.valor)
      ? lida.valor.map((item) => (item as { nome?: unknown }).nome).filter((nome): nome is string => typeof nome === 'string')
      : [],
    historico: lida.historico.map((item) => ({
      alteradoEm: item.alteradoEm,
      alteradoPorNome: item.alteradoPorNome,
      cursos: cursosAlterados(item.valorAnterior, item.valorNovo),
    })),
    editavel: lida.editavel,
  };
}

/**
 * Cria (sem `nomeOriginal`) ou altera um curso. A alteração passa a valer na
 * hora para cadastro, vitrine e rodízio; serviços que um curso deixa de
 * permitir somem das permissões efetivas de quem está vinculado a ele, e
 * serviços novos continuam dependendo de homologação.
 */
export async function salvarCursoDoCatalogo(
  organizationId: string,
  corpo: Record<string, unknown>,
  autor: AutorDaSessao
): Promise<CursoPos> {
  const lida = await lerConfiguracaoGestao<unknown>(organizationId, CHAVE_CATALOGO_CURSOS);
  const catalogo = catalogoEfetivo(lida.valor);
  const nomeOriginal = typeof corpo.nomeOriginal === 'string' ? corpo.nomeOriginal : undefined;
  const existente = nomeOriginal ? catalogo.find((curso) => curso.nome === nomeOriginal) : undefined;
  if (nomeOriginal && !existente) throw new ApplicationError('NOT_FOUND', 'Curso não encontrado no catálogo.', 404);
  const validado = validarCurso(corpo, catalogo, existente);
  if (!validado.ok) throw new ApplicationError('INVALID_INPUT', validado.erro, 400);
  await gravarConfiguracaoGestao(organizationId, CHAVE_CATALOGO_CURSOS, comCursoAjustado(lida.valor, validado.curso), autor);
  cache = null;
  return validado.curso;
}
