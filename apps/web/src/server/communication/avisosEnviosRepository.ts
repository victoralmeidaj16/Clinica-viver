import 'server-only';

import { randomUUID } from 'node:crypto';
import type { RowDataPacket } from 'mysql2';
import type { CanalAviso, DestinatarioAviso } from '@/lib/avisos/catalogo';
import { decryptDocument, encryptDocument } from '@/server/documents/documentEncryption';
import { getMysqlPool, isMysqlConfigured } from '@/server/oci/runtime';
import { fromSqlTimestamp, instituicaoId } from '@/server/persistence/mysql/mappers';

/**
 * Registro dos avisos enviados (migration 104; especificação 12.04).
 *
 * Gravar o registro nunca derruba o envio: a mensagem já saiu (ou falhou)
 * quando esta função roda, e perder a linha do log é menos grave que fazer o
 * chamador achar que o aviso não aconteceu.
 */

export type SituacaoEnvioAviso =
  | 'enviada'
  | 'falha'
  | 'bloqueada_allowlist'
  | 'provedor_desconfigurado'
  | 'destinatario_invalido'
  | 'registrado';

export interface NovoRegistroDeEnvio {
  finalidade: string;
  chaveDedupe: string;
  canal: Exclude<CanalAviso, 'whatsapp_email'>;
  destinatarioTipo: DestinatarioAviso;
  /** Telefone ou e-mail. Só os 4 últimos caracteres ficam legíveis. */
  destino?: string;
  /** Protocolo, agendamento ou cadastro que originou o aviso. */
  referencia?: string;
  situacao: SituacaoEnvioAviso;
  reenvioSeguro?: boolean;
  modeloVersao: number;
  /** Ausente quando o texto não pode ser guardado (segredo) ou não há canal externo. */
  conteudo?: { destino: string; texto: string };
  reenvioDe?: string;
  autor?: { usuarioRef: string; nome?: string };
}

export interface RegistroDeEnvio {
  id: string;
  finalidade: string;
  chaveDedupe: string;
  canal: string;
  destinatarioTipo: string;
  destinoFinal?: string;
  referencia?: string;
  situacao: SituacaoEnvioAviso;
  reenvioSeguro?: boolean;
  modeloVersao: number;
  tentativas: number;
  podeReenviar: boolean;
  reenvioDe?: string;
  reenviadoEm?: string;
  autorNome?: string;
  criadoEm: string;
  atualizadoEm: string;
}

export interface FiltroDeEnvios {
  apenasNaoEntregues?: boolean;
  finalidade?: string;
  desde?: Date;
  ate?: Date;
  limite?: number;
}

const ESCOPO_CIFRA = 'aviso-envio';
const memoria: Array<RegistroDeEnvio & { conteudo?: string }> = [];
let temTabela = false;

async function tabelaDisponivel(): Promise<boolean> {
  if (temTabela) return true;
  try {
    const [rows] = await getMysqlPool().query<RowDataPacket[]>(
      `SELECT COUNT(*) AS total FROM information_schema.tables
        WHERE table_schema = DATABASE() AND table_name = 'clinica_avisos_envios'`
    );
    temTabela = Number(rows[0]?.total ?? 0) === 1;
  } catch {
    return false;
  }
  return temTabela;
}

export async function registroDeEnviosDisponivel(): Promise<boolean> {
  return isMysqlConfigured() ? tabelaDisponivel() : process.env.NODE_ENV !== 'production';
}

function finalDoDestino(destino: string | undefined): string | null {
  const limpo = destino?.trim();
  if (!limpo) return null;
  const digitos = limpo.replace(/\D/g, '');
  return (digitos.length >= 4 && !limpo.includes('@') ? digitos : limpo).slice(-4);
}

function cifrar(conteudo: NovoRegistroDeEnvio['conteudo']): string | null {
  if (!conteudo) return null;
  try {
    return encryptDocument(conteudo, ESCOPO_CIFRA);
  } catch {
    // Sem a chave configurada o registro existe, mas sem reenvio por aqui.
    return null;
  }
}

export async function registrarEnvioDeAviso(registro: NovoRegistroDeEnvio): Promise<string | null> {
  try {
    const conteudo = cifrar(registro.conteudo);
    if (!isMysqlConfigured()) {
      if (process.env.NODE_ENV === 'production') return null;
      const existente = memoria.find((item) => item.chaveDedupe === registro.chaveDedupe && item.canal === registro.canal);
      const agora = new Date().toISOString();
      if (existente) {
        const repetida = existente.situacao === 'enviada' && registro.situacao === 'enviada';
        Object.assign(existente, { situacao: registro.situacao, reenvioSeguro: registro.reenvioSeguro,
          tentativas: existente.tentativas + (repetida ? 0 : 1), atualizadoEm: agora, conteudo: conteudo ?? existente.conteudo,
          podeReenviar: Boolean(conteudo ?? existente.conteudo) });
        return existente.id;
      }
      const id = randomUUID();
      memoria.unshift({ id, finalidade: registro.finalidade, chaveDedupe: registro.chaveDedupe, canal: registro.canal,
        destinatarioTipo: registro.destinatarioTipo, destinoFinal: finalDoDestino(registro.destino) ?? undefined,
        referencia: registro.referencia, situacao: registro.situacao, reenvioSeguro: registro.reenvioSeguro,
        modeloVersao: registro.modeloVersao, tentativas: 1, podeReenviar: Boolean(conteudo), reenvioDe: registro.reenvioDe,
        autorNome: registro.autor?.nome, criadoEm: agora, atualizadoEm: agora, conteudo: conteudo ?? undefined });
      return id;
    }
    if (!(await tabelaDisponivel())) return null;
    const id = randomUUID();
    await getMysqlPool().execute(
      `INSERT INTO clinica_avisos_envios
         (id, instituicao_id, finalidade, chave_dedupe, canal, destinatario_tipo, destino_final, referencia,
          situacao, reenvio_seguro, modelo_versao, conteudo_cifrado, reenvio_de, autor_ref, autor_nome)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
       ON DUPLICATE KEY UPDATE
         -- Antes de atualizar a situação: a mesma chave já entregue (trava de
         -- duplicidade do provedor) não conta como nova tentativa.
         tentativas = IF(situacao = 'enviada' AND VALUES(situacao) = 'enviada', tentativas, tentativas + 1),
         situacao = VALUES(situacao), reenvio_seguro = VALUES(reenvio_seguro),
         modelo_versao = VALUES(modelo_versao),
         conteudo_cifrado = COALESCE(VALUES(conteudo_cifrado), conteudo_cifrado)`,
      [id, instituicaoId(), registro.finalidade, registro.chaveDedupe.slice(0, 255), registro.canal,
        registro.destinatarioTipo, finalDoDestino(registro.destino), registro.referencia?.slice(0, 255) ?? null,
        registro.situacao, registro.reenvioSeguro === undefined ? null : registro.reenvioSeguro ? 1 : 0,
        registro.modeloVersao, conteudo, registro.reenvioDe ?? null, registro.autor?.usuarioRef ?? null,
        registro.autor?.nome ?? null]
    );
    const [rows] = await getMysqlPool().query<RowDataPacket[]>(
      'SELECT id FROM clinica_avisos_envios WHERE instituicao_id = ? AND chave_dedupe = ? AND canal = ? LIMIT 1',
      [instituicaoId(), registro.chaveDedupe.slice(0, 255), registro.canal]
    );
    return rows[0] ? String(rows[0].id) : id;
  } catch (erro) {
    console.warn(`[avisos] Não foi possível registrar o envio "${registro.finalidade}".`, erro instanceof Error ? erro.message : '');
    return null;
  }
}

function deLinha(linha: RowDataPacket): RegistroDeEnvio {
  return {
    id: String(linha.id),
    finalidade: String(linha.finalidade),
    chaveDedupe: String(linha.chave_dedupe),
    canal: String(linha.canal),
    destinatarioTipo: String(linha.destinatario_tipo),
    destinoFinal: linha.destino_final ? String(linha.destino_final) : undefined,
    referencia: linha.referencia ? String(linha.referencia) : undefined,
    situacao: String(linha.situacao) as SituacaoEnvioAviso,
    reenvioSeguro: linha.reenvio_seguro === null || linha.reenvio_seguro === undefined ? undefined : Boolean(linha.reenvio_seguro),
    modeloVersao: Number(linha.modelo_versao ?? 0),
    tentativas: Number(linha.tentativas ?? 1),
    podeReenviar: Boolean(linha.tem_conteudo),
    reenvioDe: linha.reenvio_de ? String(linha.reenvio_de) : undefined,
    reenviadoEm: fromSqlTimestamp(linha.reenviado_em) ?? undefined,
    autorNome: linha.autor_nome ? String(linha.autor_nome) : undefined,
    criadoEm: fromSqlTimestamp(linha.criado_em) ?? new Date(0).toISOString(),
    atualizadoEm: fromSqlTimestamp(linha.atualizado_em) ?? new Date(0).toISOString(),
  };
}

export const SITUACOES_NAO_ENTREGUES: readonly SituacaoEnvioAviso[] = [
  'falha', 'bloqueada_allowlist', 'provedor_desconfigurado', 'destinatario_invalido',
];

export async function listarEnviosDeAvisos(filtro: FiltroDeEnvios = {}): Promise<RegistroDeEnvio[]> {
  const limite = Math.min(Math.max(filtro.limite ?? 200, 1), 1000);
  if (!isMysqlConfigured()) {
    return memoria
      .filter((item) => !filtro.apenasNaoEntregues || SITUACOES_NAO_ENTREGUES.includes(item.situacao))
      .filter((item) => !filtro.finalidade || item.finalidade === filtro.finalidade)
      .slice(0, limite)
      .map((item) => {
        const copia: RegistroDeEnvio & { conteudo?: string } = { ...item };
        delete copia.conteudo;
        return copia;
      });
  }
  if (!(await tabelaDisponivel())) return [];
  const condicoes = ['instituicao_id = ?'];
  const valores: unknown[] = [instituicaoId()];
  if (filtro.apenasNaoEntregues) {
    condicoes.push(`situacao IN (${SITUACOES_NAO_ENTREGUES.map(() => '?').join(', ')})`, 'reenviado_em IS NULL');
    valores.push(...SITUACOES_NAO_ENTREGUES);
  }
  if (filtro.finalidade) { condicoes.push('finalidade = ?'); valores.push(filtro.finalidade); }
  if (filtro.desde) { condicoes.push('criado_em >= ?'); valores.push(filtro.desde); }
  if (filtro.ate) { condicoes.push('criado_em <= ?'); valores.push(filtro.ate); }
  const [rows] = await getMysqlPool().query<RowDataPacket[]>(
    `SELECT id, finalidade, chave_dedupe, canal, destinatario_tipo, destino_final, referencia, situacao,
            reenvio_seguro, modelo_versao, tentativas, conteudo_cifrado IS NOT NULL AS tem_conteudo,
            reenvio_de, reenviado_em, autor_nome, criado_em, atualizado_em
       FROM clinica_avisos_envios WHERE ${condicoes.join(' AND ')}
      ORDER BY criado_em DESC LIMIT ${limite}`,
    valores
  );
  return rows.map(deLinha);
}

export interface EnvioParaReenvio {
  registro: RegistroDeEnvio;
  conteudo: { destino: string; texto: string } | null;
}

export async function obterEnvioParaReenvio(id: string): Promise<EnvioParaReenvio | null> {
  if (!isMysqlConfigured()) {
    const item = memoria.find((linha) => linha.id === id);
    if (!item) return null;
    const { conteudo, ...registro } = item;
    return { registro, conteudo: conteudo ? decryptDocument(conteudo, ESCOPO_CIFRA) : null };
  }
  if (!(await tabelaDisponivel())) return null;
  const [rows] = await getMysqlPool().query<RowDataPacket[]>(
    `SELECT *, conteudo_cifrado IS NOT NULL AS tem_conteudo FROM clinica_avisos_envios
      WHERE instituicao_id = ? AND id = ? LIMIT 1`,
    [instituicaoId(), id]
  );
  const linha = rows[0];
  if (!linha) return null;
  let conteudo: EnvioParaReenvio['conteudo'] = null;
  if (linha.conteudo_cifrado) {
    try {
      conteudo = decryptDocument(String(linha.conteudo_cifrado), ESCOPO_CIFRA);
    } catch {
      conteudo = null;
    }
  }
  return { registro: deLinha(linha), conteudo };
}

/** Marca a original como reenviada; `false` se outra pessoa reenviou antes. */
export async function marcarEnvioReenviado(id: string, agora: Date = new Date()): Promise<boolean> {
  if (!isMysqlConfigured()) {
    const item = memoria.find((linha) => linha.id === id);
    if (!item || item.reenviadoEm) return false;
    item.reenviadoEm = agora.toISOString();
    return true;
  }
  const [resultado] = await getMysqlPool().execute(
    'UPDATE clinica_avisos_envios SET reenviado_em = ? WHERE instituicao_id = ? AND id = ? AND reenviado_em IS NULL',
    [agora, instituicaoId(), id]
  );
  return (resultado as { affectedRows?: number }).affectedRows === 1;
}

/** Desfaz a marca quando o reenvio não chegou a sair. */
export async function desmarcarEnvioReenviado(id: string): Promise<void> {
  if (!isMysqlConfigured()) {
    const item = memoria.find((linha) => linha.id === id);
    if (item) item.reenviadoEm = undefined;
    return;
  }
  await getMysqlPool().execute(
    'UPDATE clinica_avisos_envios SET reenviado_em = NULL WHERE instituicao_id = ? AND id = ?',
    [instituicaoId(), id]
  ).catch(() => undefined);
}

/** Algum envio com a chave (ou começando por ela) já foi registrado? */
export async function envioJaRegistrado(prefixoDaChave: string): Promise<boolean> {
  if (!isMysqlConfigured()) return memoria.some((item) => item.chaveDedupe.startsWith(prefixoDaChave));
  if (!(await tabelaDisponivel())) return false;
  const [rows] = await getMysqlPool().query<RowDataPacket[]>(
    `SELECT 1 FROM clinica_avisos_envios WHERE instituicao_id = ? AND chave_dedupe LIKE ? LIMIT 1`,
    [instituicaoId(), `${prefixoDaChave.replace(/[\\%_]/g, (c) => `\\${c}`)}%`]
  );
  return rows.length > 0;
}

/** Contagem para o painel de ocorrências (13.06). */
export async function contarAvisosNaoEntregues(desde: Date): Promise<number> {
  return (await listarEnviosDeAvisos({ apenasNaoEntregues: true, desde, limite: 1000 })).length;
}
