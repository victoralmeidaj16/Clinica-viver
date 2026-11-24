'use client';

import { useEffect, useState } from 'react';
import { TURMAS_ATIVAS } from '@/lib/turmaEncerrada';
import { CATALOGO_CURSOS_PADRAO, type CursoPos } from './opcoesPsicologo';

export interface CatalogoCursosCliente {
  cursos: readonly CursoPos[];
  /** Turmas abertas por curso, como a Gestão cadastrou (1.01). */
  turmasPorCurso: Readonly<Record<string, readonly string[]>>;
  carregado: boolean;
}

export const CATALOGO_CLIENTE_PADRAO: CatalogoCursosCliente = {
  cursos: CATALOGO_CURSOS_PADRAO,
  turmasPorCurso: Object.fromEntries(CATALOGO_CURSOS_PADRAO.map((curso) => [curso.nome, TURMAS_ATIVAS])),
  carregado: false,
};

let pedido: Promise<CatalogoCursosCliente> | null = null;

function carregar(): Promise<CatalogoCursosCliente> {
  pedido ??= fetch('/api/application/cursos', { cache: 'no-store' })
    .then((resposta) => resposta.json())
    .then((corpo: { success?: boolean; data?: { cursos?: CursoPos[]; turmasPorCurso?: Record<string, string[]> } }) => {
      if (!corpo.success || !Array.isArray(corpo.data?.cursos) || !corpo.data.cursos.length) return { ...CATALOGO_CLIENTE_PADRAO, carregado: true };
      return { cursos: corpo.data.cursos, turmasPorCurso: corpo.data.turmasPorCurso ?? CATALOGO_CLIENTE_PADRAO.turmasPorCurso, carregado: true };
    })
    .catch(() => {
      pedido = null;
      return { ...CATALOGO_CLIENTE_PADRAO, carregado: true };
    });
  return pedido;
}

/** Esquece o catálogo em memória — depois de a Gestão salvar um curso ou uma turma. */
export function recarregarCatalogoCursos(): void {
  pedido = null;
}

/**
 * Catálogo de cursos e turmas abertas para os formulários (1.01 e 2.01).
 * Enquanto carrega — ou se a API falhar — vale o catálogo padrão, que é o que
 * os formulários sempre usaram.
 */
export function useCatalogoCursos(): CatalogoCursosCliente {
  const [catalogo, setCatalogo] = useState<CatalogoCursosCliente>(CATALOGO_CLIENTE_PADRAO);
  useEffect(() => {
    let ativo = true;
    void carregar().then((dados) => { if (ativo) setCatalogo(dados); });
    return () => { ativo = false; };
  }, []);
  return catalogo;
}

/** Opções de turma para um curso, mantendo a já gravada mesmo que encerrada. */
export function turmasParaSelecao(catalogo: CatalogoCursosCliente, curso: string, atual?: string): string[] {
  const abertas = [...(catalogo.turmasPorCurso[curso] ?? TURMAS_ATIVAS)];
  return atual && !abertas.includes(atual) ? [...abertas, atual] : abertas;
}

/** Cursos para seleção: os ativos, mais o já gravado mesmo que inativo. */
export function cursosParaSelecao(catalogo: CatalogoCursosCliente, atual?: string): string[] {
  const ativos = catalogo.cursos.filter((curso) => curso.ativo).map((curso) => curso.nome);
  return atual && !ativos.includes(atual) ? [...ativos, atual] : ativos;
}
