import 'server-only';

import type { RowDataPacket } from 'mysql2';
import type { Pool, PoolConnection } from 'mysql2/promise';
import { prazoOfertaValido } from '@/lib/prazoOferta';
import { fromSqlTimestamp, instituicaoId, rowId, toSqlTimestamp } from './mappers';

/**
 * Configurações da Gestão no MySQL (migration 087). Cada mudança grava o valor
 * atual e uma linha de histórico na mesma transação (13.02).
 */

export const CHAVE_PRAZO_OFERTA = 'prazo_oferta_horas';

export interface AlteracaoConfiguracao {
  valorAnterior: unknown;
  valorNovo: unknown;
  alteradoEm: string;
  alteradoPorUsuarioRef?: string;
  alteradoPorNome?: string;
}

export interface ConfiguracaoLida {
  valor: unknown;
  atualizadoEm: string;
  atualizadoPorUsuarioRef?: string;
  atualizadoPorNome?: string;
  historico: AlteracaoConfiguracao[];
}

let temTabelas = false;

/** Só o "sim" fica em cache, para a migration valer sem reiniciar o processo. */
export async function configuracoesDisponiveis(connection: Pool | PoolConnection): Promise<boolean> {
  if (temTabelas) return true;
  try {
    const [rows] = await connection.query<RowDataPacket[]>(
      `SELECT COUNT(*) AS total FROM information_schema.tables
        WHERE table_schema = DATABASE()
          AND table_name IN ('clinica_configuracoes_gestao', 'clinica_configuracoes_gestao_historico')`
    );
    temTabelas = Number(rows[0]?.total ?? 0) === 2;
  } catch {
    return false;
  }
  return temTabelas;
}

function json(valor: unknown): unknown {
  if (typeof valor !== 'string') return valor;
  try {
    return JSON.parse(valor) as unknown;
  } catch {
    return valor;
  }
}

/** Prazo gravado para a organização, ou `undefined` (sem tabela ou sem linha). */
export async function lerPrazoOfertaConfigurado(
  connection: Pool | PoolConnection,
  organizacaoRef: string
): Promise<number | undefined> {
  if (!(await configuracoesDisponiveis(connection))) return undefined;
  try {
    const [rows] = await connection.query<RowDataPacket[]>(
      `SELECT valor FROM clinica_configuracoes_gestao
        WHERE instituicao_id = ? AND organizacao_ref = ? AND chave = ? LIMIT 1`,
      [instituicaoId(), organizacaoRef, CHAVE_PRAZO_OFERTA]
    );
    return prazoOfertaValido(json(rows[0]?.valor)) ?? undefined;
  } catch {
    // A captação não pode parar por causa da configuração: vale o padrão.
    return undefined;
  }
}

export async function lerConfiguracao(
  connection: Pool | PoolConnection,
  organizacaoRef: string,
  chave: string
): Promise<ConfiguracaoLida | null> {
  if (!(await configuracoesDisponiveis(connection))) return null;
  const [atual] = await connection.query<RowDataPacket[]>(
    `SELECT valor, atualizado_em, atualizado_por_usuario_ref, atualizado_por_nome
       FROM clinica_configuracoes_gestao
      WHERE instituicao_id = ? AND organizacao_ref = ? AND chave = ? LIMIT 1`,
    [instituicaoId(), organizacaoRef, chave]
  );
  const [historico] = await connection.query<RowDataPacket[]>(
    `SELECT valor_anterior, valor_novo, alterado_em, alterado_por_usuario_ref, alterado_por_nome
       FROM clinica_configuracoes_gestao_historico
      WHERE instituicao_id = ? AND organizacao_ref = ? AND chave = ?
      ORDER BY alterado_em DESC LIMIT 20`,
    [instituicaoId(), organizacaoRef, chave]
  );
  if (!atual[0]) return null;
  return {
    valor: json(atual[0].valor),
    atualizadoEm: fromSqlTimestamp(atual[0].atualizado_em) ?? new Date(0).toISOString(),
    atualizadoPorUsuarioRef: atual[0].atualizado_por_usuario_ref ?? undefined,
    atualizadoPorNome: atual[0].atualizado_por_nome ?? undefined,
    historico: historico.map((linha) => ({
      valorAnterior: json(linha.valor_anterior),
      valorNovo: json(linha.valor_novo),
      alteradoEm: fromSqlTimestamp(linha.alterado_em) ?? new Date(0).toISOString(),
      alteradoPorUsuarioRef: linha.alterado_por_usuario_ref ?? undefined,
      alteradoPorNome: linha.alterado_por_nome ?? undefined,
    })),
  };
}

/** Grava o valor novo e o histórico na mesma transação. */
export async function gravarConfiguracao(
  pool: Pool,
  organizacaoRef: string,
  chave: string,
  valor: unknown,
  autor: { usuarioRef: string; nome?: string },
  agora: Date = new Date()
): Promise<void> {
  if (!(await configuracoesDisponiveis(pool))) {
    throw new Error('As configurações da Gestão requerem a migration 087_configuracoes_gestao.sql.');
  }
  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();
    const [rows] = await connection.query<RowDataPacket[]>(
      `SELECT valor FROM clinica_configuracoes_gestao
        WHERE instituicao_id = ? AND organizacao_ref = ? AND chave = ? FOR UPDATE`,
      [instituicaoId(), organizacaoRef, chave]
    );
    const anterior = rows[0] ? json(rows[0].valor) : null;
    const quando = toSqlTimestamp(agora.toISOString());
    await connection.execute(
      `INSERT INTO clinica_configuracoes_gestao
         (id, instituicao_id, organizacao_ref, chave, valor, atualizado_por_usuario_ref, atualizado_por_nome, atualizado_em)
       VALUES (?, ?, ?, ?, CAST(? AS JSON), ?, ?, ?)
       ON DUPLICATE KEY UPDATE valor = VALUES(valor),
         atualizado_por_usuario_ref = VALUES(atualizado_por_usuario_ref),
         atualizado_por_nome = VALUES(atualizado_por_nome), atualizado_em = VALUES(atualizado_em)`,
      [rowId('configuracao_gestao', `${organizacaoRef}:${chave}`), instituicaoId(), organizacaoRef, chave,
        JSON.stringify(valor), autor.usuarioRef, autor.nome ?? null, quando]
    );
    await connection.execute(
      `INSERT INTO clinica_configuracoes_gestao_historico
         (id, instituicao_id, organizacao_ref, chave, valor_anterior, valor_novo,
          alterado_por_usuario_ref, alterado_por_nome, alterado_em)
       VALUES (?, ?, ?, ?, CAST(? AS JSON), CAST(? AS JSON), ?, ?, ?)`,
      [rowId('configuracao_gestao_historico', `${organizacaoRef}:${chave}:${agora.toISOString()}`),
        instituicaoId(), organizacaoRef, chave, JSON.stringify(anterior), JSON.stringify(valor),
        autor.usuarioRef, autor.nome ?? null, quando]
    );
    await connection.commit();
  } catch (erro) {
    await connection.rollback();
    throw erro;
  } finally {
    connection.release();
  }
}
