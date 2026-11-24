import 'server-only';

import { randomUUID } from 'node:crypto';
import type { RowDataPacket } from 'mysql2';
import type { CampoAlterado } from '@/lib/auditoria';
import { getMysqlPool, isMysqlConfigured } from '@/server/oci/runtime';
import { fromSqlTimestamp, instituicaoId } from '@/server/persistence/mysql/mappers';
import type { AutorDaSessao } from './autorGestao';

/**
 * Trilha de auditoria das intervenções administrativas (13.02; migration 105).
 *
 * `registrarAlteracao` nunca lança: a intervenção já foi gravada quando ela
 * roda, e a falha de auditoria vira log — não desfaz a correção que a Gestão
 * fez. A leitura junta esta trilha com os históricos que já existiam por
 * módulo, para a Gestão ter um lugar só.
 */

export interface NovaAlteracao {
  organizationId: string;
  modulo: string;
  entidadeTipo: string;
  entidadeRef: string;
  entidadeRotulo?: string;
  acao: string;
  campos: readonly CampoAlterado[];
  motivo?: string;
  autor: AutorDaSessao;
}

export interface AlteracaoRegistrada {
  id: string;
  fonte: 'auditoria' | 'configuracao' | 'agenda' | 'perfil';
  modulo: string;
  entidadeTipo: string;
  entidadeRef: string;
  entidadeRotulo?: string;
  acao: string;
  campos: CampoAlterado[];
  motivo?: string;
  autorNome?: string;
  autorRef?: string;
  criadoEm: string;
}

const memoria: AlteracaoRegistrada[] = [];
let temTabela = false;

async function tabelaDisponivel(): Promise<boolean> {
  if (temTabela) return true;
  try {
    const [rows] = await getMysqlPool().query<RowDataPacket[]>(
      `SELECT COUNT(*) AS total FROM information_schema.tables
        WHERE table_schema = DATABASE() AND table_name = 'clinica_auditoria_alteracoes'`
    );
    temTabela = Number(rows[0]?.total ?? 0) === 1;
  } catch {
    return false;
  }
  return temTabela;
}

export async function registrarAlteracao(alteracao: NovaAlteracao, agora: Date = new Date()): Promise<void> {
  // Sem mudança real não há o que auditar; inativar/reativar sempre tem a própria ação.
  if (!alteracao.campos.length && !alteracao.motivo) return;
  try {
    if (!isMysqlConfigured()) {
      if (process.env.NODE_ENV === 'production') return;
      memoria.unshift({ id: randomUUID(), fonte: 'auditoria', modulo: alteracao.modulo, entidadeTipo: alteracao.entidadeTipo,
        entidadeRef: alteracao.entidadeRef, entidadeRotulo: alteracao.entidadeRotulo, acao: alteracao.acao,
        campos: [...alteracao.campos], motivo: alteracao.motivo, autorNome: alteracao.autor.nome,
        autorRef: alteracao.autor.usuarioRef, criadoEm: agora.toISOString() });
      return;
    }
    if (!(await tabelaDisponivel())) {
      console.warn(`[auditoria] Migration 105 ausente; "${alteracao.acao}" não entrou na trilha.`);
      return;
    }
    await getMysqlPool().execute(
      `INSERT INTO clinica_auditoria_alteracoes
         (id, instituicao_id, organizacao_ref, modulo, entidade_tipo, entidade_ref, entidade_rotulo, acao,
          campos, motivo, autor_ref, autor_nome, criado_em)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, CAST(? AS JSON), ?, ?, ?, ?)`,
      [randomUUID(), instituicaoId(), alteracao.organizationId, alteracao.modulo, alteracao.entidadeTipo,
        alteracao.entidadeRef.slice(0, 191), alteracao.entidadeRotulo?.slice(0, 255) ?? null, alteracao.acao,
        JSON.stringify(alteracao.campos), alteracao.motivo?.slice(0, 1000) ?? null,
        alteracao.autor.usuarioRef, alteracao.autor.nome ?? null, agora]
    );
  } catch (erro) {
    console.error(`[auditoria] Falha ao registrar "${alteracao.acao}":`, erro instanceof Error ? erro.message : erro);
  }
}

export interface FiltroDeAlteracoes {
  modulo?: string;
  entidadeRef?: string;
  desde?: Date;
  ate?: Date;
  limite?: number;
}

function json<T>(valor: unknown, padrao: T): T {
  if (typeof valor !== 'string') return (valor as T) ?? padrao;
  try { return JSON.parse(valor) as T; } catch { return padrao; }
}

function resumo(valor: unknown): string {
  if (valor === null || valor === undefined) return '—';
  if (typeof valor === 'object' && 'versao' in (valor as object)) return `versão ${(valor as { versao: unknown }).versao}`;
  const texto = typeof valor === 'string' ? valor : JSON.stringify(valor);
  return texto.length > 280 ? `${texto.slice(0, 277)}…` : texto;
}

function moduloDaConfiguracao(chave: string): string {
  return /turma|curso|demanda/.test(chave) ? 'turmas' : 'configuracoes';
}

function periodo(coluna: string, filtro: FiltroDeAlteracoes, valores: unknown[]): string {
  let sql = '';
  if (filtro.desde) { sql += ` AND ${coluna} >= ?`; valores.push(filtro.desde); }
  if (filtro.ate) { sql += ` AND ${coluna} <= ?`; valores.push(filtro.ate); }
  return sql;
}

async function daTrilha(organizationId: string, filtro: FiltroDeAlteracoes, limite: number): Promise<AlteracaoRegistrada[]> {
  if (!(await tabelaDisponivel())) return [];
  const valores: unknown[] = [instituicaoId(), organizationId];
  let sql = `SELECT * FROM clinica_auditoria_alteracoes WHERE instituicao_id = ? AND organizacao_ref = ?`;
  if (filtro.modulo) { sql += ' AND modulo = ?'; valores.push(filtro.modulo); }
  if (filtro.entidadeRef) { sql += ' AND entidade_ref = ?'; valores.push(filtro.entidadeRef); }
  sql += periodo('criado_em', filtro, valores);
  const [rows] = await getMysqlPool().query<RowDataPacket[]>(`${sql} ORDER BY criado_em DESC LIMIT ${limite}`, valores);
  return rows.map((r) => ({
    id: String(r.id), fonte: 'auditoria' as const, modulo: String(r.modulo), entidadeTipo: String(r.entidade_tipo),
    entidadeRef: String(r.entidade_ref), entidadeRotulo: r.entidade_rotulo ?? undefined, acao: String(r.acao),
    campos: json<CampoAlterado[]>(r.campos, []), motivo: r.motivo ?? undefined, autorNome: r.autor_nome ?? undefined,
    autorRef: r.autor_ref ?? undefined, criadoEm: fromSqlTimestamp(r.criado_em) ?? new Date(0).toISOString(),
  }));
}

/** Históricos que já existiam por módulo, no mesmo formato. Tabela ausente vira lista vazia. */
async function dosHistoricosAntigos(organizationId: string, filtro: FiltroDeAlteracoes, limite: number): Promise<AlteracaoRegistrada[]> {
  const pool = getMysqlPool();
  const consultas: Array<Promise<AlteracaoRegistrada[]>> = [];
  if (!filtro.modulo || filtro.modulo === 'configuracoes' || filtro.modulo === 'turmas') {
    const valores: unknown[] = [instituicaoId(), organizationId];
    const sql = `SELECT id, chave, valor_anterior, valor_novo, alterado_por_usuario_ref, alterado_por_nome, alterado_em
      FROM clinica_configuracoes_gestao_historico WHERE instituicao_id = ? AND organizacao_ref = ?${periodo('alterado_em', filtro, valores)}
      ORDER BY alterado_em DESC LIMIT ${limite}`;
    consultas.push(pool.query<RowDataPacket[]>(sql, valores).then(([rows]) => rows.map((r) => ({
      id: String(r.id), fonte: 'configuracao' as const, modulo: moduloDaConfiguracao(String(r.chave)), entidadeTipo: 'configuracao',
      entidadeRef: String(r.chave), entidadeRotulo: String(r.chave), acao: 'alterar_configuracao',
      campos: [{ campo: String(r.chave), rotulo: String(r.chave), anterior: resumo(json(r.valor_anterior, null)), novo: resumo(json(r.valor_novo, null)) }],
      autorNome: r.alterado_por_nome ?? undefined, autorRef: r.alterado_por_usuario_ref ?? undefined,
      criadoEm: fromSqlTimestamp(r.alterado_em) ?? new Date(0).toISOString(),
    })).filter((item) => !filtro.modulo || item.modulo === filtro.modulo)).catch(() => []));
  }
  if (!filtro.modulo || filtro.modulo === 'agenda') {
    const valores: unknown[] = [instituicaoId(), organizationId];
    const sql = `SELECT id, agendamento_id, alterado_por_usuario_ref, alterado_por_nome, alterado_em, mudancas
      FROM clinica_agendamentos_alteracoes WHERE instituicao_id = ? AND organizacao_ref = ?${periodo('alterado_em', filtro, valores)}
      ORDER BY alterado_em DESC LIMIT ${limite}`;
    consultas.push(pool.query<RowDataPacket[]>(sql, valores).then(([rows]) => rows.map((r) => ({
      id: String(r.id), fonte: 'agenda' as const, modulo: 'agenda', entidadeTipo: 'agendamento', entidadeRef: String(r.agendamento_id),
      acao: 'alterar_agendamento',
      campos: json<Array<{ campo: string; rotulo: string; de: string; para: string }>>(r.mudancas, [])
        .map((m) => ({ campo: m.campo, rotulo: m.rotulo, anterior: m.de, novo: m.para })),
      autorNome: r.alterado_por_nome ?? undefined, autorRef: r.alterado_por_usuario_ref ?? undefined,
      criadoEm: fromSqlTimestamp(r.alterado_em) ?? new Date(0).toISOString(),
    }))).catch(() => []));
  }
  if (!filtro.modulo || filtro.modulo === 'psicologos') {
    const valores: unknown[] = [instituicaoId(), organizationId];
    const sql = `SELECT id, cadastro_ref, psicologo_nome, alterado_por_usuario_ref, alterado_em, mudancas
      FROM clinica_psicologos_alteracoes_perfil WHERE instituicao_id = ? AND organizacao_ref = ?${periodo('alterado_em', filtro, valores)}
      ORDER BY alterado_em DESC LIMIT ${limite}`;
    consultas.push(pool.query<RowDataPacket[]>(sql, valores).then(([rows]) => rows.map((r) => ({
      id: String(r.id), fonte: 'perfil' as const, modulo: 'psicologos', entidadeTipo: 'cadastro_psicologo', entidadeRef: String(r.cadastro_ref),
      entidadeRotulo: String(r.psicologo_nome), acao: 'alterar_perfil',
      campos: json<Array<{ campo: string; rotulo: string; de: string; para: string }>>(r.mudancas, [])
        .map((m) => ({ campo: m.campo, rotulo: m.rotulo, anterior: m.de, novo: m.para })),
      autorRef: r.alterado_por_usuario_ref ?? undefined,
      criadoEm: fromSqlTimestamp(r.alterado_em) ?? new Date(0).toISOString(),
    }))).catch(() => []));
  }
  return (await Promise.all(consultas)).flat()
    .filter((item) => !filtro.entidadeRef || item.entidadeRef === filtro.entidadeRef);
}

export async function listarAlteracoes(organizationId: string, filtro: FiltroDeAlteracoes = {}): Promise<AlteracaoRegistrada[]> {
  const limite = Math.min(Math.max(filtro.limite ?? 300, 1), 2000);
  if (!isMysqlConfigured()) {
    return memoria.filter((item) => (!filtro.modulo || item.modulo === filtro.modulo)
      && (!filtro.entidadeRef || item.entidadeRef === filtro.entidadeRef)).slice(0, limite);
  }
  const [trilha, antigos] = await Promise.all([daTrilha(organizationId, filtro, limite), dosHistoricosAntigos(organizationId, filtro, limite)]);
  return [...trilha, ...antigos].sort((a, b) => b.criadoEm.localeCompare(a.criadoEm)).slice(0, limite);
}
