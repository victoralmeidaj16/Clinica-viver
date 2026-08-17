import 'server-only';

import type { Pool, ResultSetHeader, RowDataPacket } from 'mysql2/promise';
import { getMysqlPool, isMysqlConfigured } from '@/server/oci/runtime';
import { instituicaoId, rowId } from '@/server/persistence/mysql/mappers';

export type StatusEmissaoNfse = 'reserved' | 'processing' | 'issued' | 'failed' | 'cancelled';

export interface EmissaoNfse {
  id: string;
  chargeId: string;
  patientId: string;
  cnpjPrestador: string;
  serie: string;
  numeroDps: string;
  dpsId: string;
  ambiente: 'producao_restrita' | 'producao';
  valorCents: number;
  competencia: string;
  status: StatusEmissaoNfse;
  idempotencyKey: string;
  dpsXml?: string;
  nfseXml?: string;
  chaveAcesso?: string;
  numeroNfse?: string;
  sefinHttpStatus?: number;
  sefinRetorno?: string;
  erroCodigo?: string;
  erroMensagem?: string;
  canceladoEm?: string;
  cancelamentoMotivo?: string;
}

export type StatusEventoNfse = 'processing' | 'registered' | 'failed';

export interface EventoNfse {
  id: string;
  emissaoId: string;
  tipoEvento: string;
  numeroPedido: number;
  pedidoId: string;
  chaveAcesso: string;
  motivoCodigo?: string;
  motivo?: string;
  status: StatusEventoNfse;
  criadoEm: string;
  erroMensagem?: string;
}

interface EmissaoRow extends RowDataPacket {
  id: string;
  cobranca_ref: string;
  paciente_ref: string;
  cnpj_prestador: string;
  serie: string;
  numero_dps: string;
  dps_id: string;
  ambiente: EmissaoNfse['ambiente'];
  valor_centavos: number;
  competencia: string;
  status: StatusEmissaoNfse;
  idempotency_key: string;
  dps_xml: string | null;
  nfse_xml: string | null;
  chave_acesso: string | null;
  numero_nfse: string | null;
  sefin_http_status: number | null;
  sefin_retorno: string | null;
  erro_codigo: string | null;
  erro_mensagem: string | null;
  cancelado_em: string | null;
  cancelamento_motivo: string | null;
}

interface EventoRow extends RowDataPacket {
  id: string;
  emissao_id: string;
  tipo_evento: string;
  numero_pedido: number;
  pedido_id: string;
  chave_acesso: string;
  motivo_codigo: string | null;
  motivo: string | null;
  status: StatusEventoNfse;
  criado_em: string;
  erro_mensagem: string | null;
}

function toEmissao(row: EmissaoRow): EmissaoNfse {
  return {
    id: row.id, chargeId: row.cobranca_ref, patientId: row.paciente_ref,
    cnpjPrestador: row.cnpj_prestador, serie: row.serie, numeroDps: row.numero_dps,
    dpsId: row.dps_id, ambiente: row.ambiente, valorCents: Number(row.valor_centavos),
    competencia: row.competencia.slice(0, 10), status: row.status, idempotencyKey: row.idempotency_key,
    dpsXml: row.dps_xml ?? undefined, nfseXml: row.nfse_xml ?? undefined,
    chaveAcesso: row.chave_acesso ?? undefined, numeroNfse: row.numero_nfse ?? undefined,
    sefinHttpStatus: row.sefin_http_status ?? undefined, sefinRetorno: row.sefin_retorno ?? undefined,
    erroCodigo: row.erro_codigo ?? undefined, erroMensagem: row.erro_mensagem ?? undefined,
    canceladoEm: row.cancelado_em ?? undefined, cancelamentoMotivo: row.cancelamento_motivo ?? undefined,
  };
}

function toEvento(row: EventoRow): EventoNfse {
  return {
    id: row.id, emissaoId: row.emissao_id, tipoEvento: row.tipo_evento,
    numeroPedido: Number(row.numero_pedido), pedidoId: row.pedido_id, chaveAcesso: row.chave_acesso,
    motivoCodigo: row.motivo_codigo ?? undefined, motivo: row.motivo ?? undefined,
    status: row.status, criadoEm: row.criado_em, erroMensagem: row.erro_mensagem ?? undefined,
  };
}

const SELECT = `SELECT id, cobranca_ref, paciente_ref, cnpj_prestador, serie, numero_dps, dps_id,
  ambiente, valor_centavos, competencia, status, idempotency_key, dps_xml, nfse_xml,
  chave_acesso, numero_nfse, sefin_http_status, sefin_retorno, erro_codigo, erro_mensagem,
  cancelado_em, cancelamento_motivo
  FROM fiscal_nfse_emissoes`;

const SELECT_EVENTO = `SELECT id, emissao_id, tipo_evento, numero_pedido, pedido_id, chave_acesso,
  motivo_codigo, motivo, status, criado_em, erro_mensagem
  FROM fiscal_nfse_eventos`;

export function exigirPersistenciaFiscal() {
  if (!isMysqlConfigured()) throw new Error('A emissão de NFS-e exige o MySQL configurado para registrar a DPS e evitar duplicidade.');
}

export class NfseRepository {
  constructor(private readonly pool: Pool = getMysqlPool()) {}

  async porCobrancas(
    organizationId: string,
    chargeIds: readonly string[]
  ): Promise<ReadonlyMap<string, EmissaoNfse>> {
    if (chargeIds.length === 0) return new Map();
    const [rows] = await this.pool.query<EmissaoRow[]>(
      `${SELECT} WHERE instituicao_id = ? AND organizacao_ref = ? AND cobranca_ref IN (?)`,
      [instituicaoId(), organizationId, [...chargeIds]]
    );
    return new Map(rows.map((row) => {
      const emissao = toEmissao(row);
      return [emissao.chargeId, emissao] as const;
    }));
  }

  async porCobranca(organizationId: string, chargeId: string): Promise<EmissaoNfse | null> {
    const [rows] = await this.pool.query<EmissaoRow[]>(`${SELECT} WHERE instituicao_id = ? AND organizacao_ref = ? AND cobranca_ref = ?`, [
      instituicaoId(), organizationId, chargeId,
    ]);
    return rows[0] ? toEmissao(rows[0]) : null;
  }

  /** Reserva uma única DPS por cobrança. A transação impede dois cliques concorrentes. */
  async reservar(input: {
    organizationId: string; chargeId: string; patientId: string; cnpjPrestador: string;
    serie: string; ambiente: EmissaoNfse['ambiente']; valorCents: number; competencia: string;
    idempotencyKey: string; usuarioId: string;
  }): Promise<EmissaoNfse> {
    const connection = await this.pool.getConnection();
    try {
      await connection.beginTransaction();
      const [existentes] = await connection.query<EmissaoRow[]>(`${SELECT} WHERE instituicao_id = ? AND organizacao_ref = ? AND cobranca_ref = ? FOR UPDATE`, [
        instituicaoId(), input.organizationId, input.chargeId,
      ]);
      if (existentes[0]) {
        const existente = toEmissao(existentes[0]);
        await connection.commit();
        return existente;
      }

      // LAST_INSERT_ID é específico da conexão; a alocação permanece atômica
      // mesmo quando duas emissões chegam ao mesmo instante.
      await connection.query(`INSERT INTO fiscal_nfse_series
        (instituicao_id, organizacao_ref, cnpj_prestador, serie, proximo_numero)
        VALUES (?, ?, ?, ?, LAST_INSERT_ID(2))
        ON DUPLICATE KEY UPDATE proximo_numero = LAST_INSERT_ID(proximo_numero + 1)`, [
        instituicaoId(), input.organizationId, input.cnpjPrestador, input.serie,
      ]);
      const [sequencia] = await connection.query<Array<RowDataPacket & { proximoNumero: number }>>('SELECT LAST_INSERT_ID() AS proximoNumero');
      const numeroDps = String(Number(sequencia[0]?.proximoNumero ?? 0) - 1);
      if (!/^[1-9]\d*$/.test(numeroDps)) throw new Error('Não foi possível reservar a numeração da DPS.');

      // A identificação completa é montada pelo gerador. Aqui se usa uma
      // reserva determinística temporária, atualizada antes do envio.
      const refCore = `nfse:${input.chargeId}`;
      const id = rowId('fiscal-nfse-emissao', refCore);
      const dpsPendente = `PENDING-${id}`;
      await connection.query(`INSERT INTO fiscal_nfse_emissoes
        (id, instituicao_id, organizacao_ref, cobranca_ref, paciente_ref, cnpj_prestador, serie,
         numero_dps, dps_id, ambiente, valor_centavos, competencia, status, idempotency_key, emitido_por_usuario_ref)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'reserved', ?, ?)`, [
        id, instituicaoId(), input.organizationId, input.chargeId, input.patientId, input.cnpjPrestador,
        input.serie, numeroDps, dpsPendente, input.ambiente, input.valorCents, input.competencia, input.idempotencyKey, input.usuarioId,
      ]);
      await connection.commit();
      return {
        id, chargeId: input.chargeId, patientId: input.patientId, cnpjPrestador: input.cnpjPrestador,
        serie: input.serie, numeroDps, dpsId: '', ambiente: input.ambiente, valorCents: input.valorCents,
        competencia: input.competencia, status: 'reserved', idempotencyKey: input.idempotencyKey,
      };
    } catch (error) {
      await connection.rollback();
      throw error;
    } finally {
      connection.release();
    }
  }

  /** Ganha o direito de falar com a SEFIN; evita dois POSTs da mesma DPS. */
  async iniciarProcessamento(emissaoId: string): Promise<boolean> {
    const [resultado] = await this.pool.query<ResultSetHeader>(`UPDATE fiscal_nfse_emissoes
      SET status = 'processing', processando_em = CURRENT_TIMESTAMP(3), erro_codigo = NULL, erro_mensagem = NULL
      WHERE instituicao_id = ? AND id = ?
        AND (status IN ('reserved', 'failed') OR (status = 'processing' AND processando_em < DATE_SUB(CURRENT_TIMESTAMP(3), INTERVAL 2 MINUTE)))`, [
      instituicaoId(), emissaoId,
    ]);
    return resultado.affectedRows === 1;
  }

  async salvarDps(emissaoId: string, dpsId: string, xmlAssinado: string) {
    await this.pool.query(`UPDATE fiscal_nfse_emissoes SET dps_id = ?, dps_xml = ? WHERE instituicao_id = ? AND id = ?`, [
      dpsId, xmlAssinado, instituicaoId(), emissaoId,
    ]);
  }

  async registrarNota(emissaoId: string, resposta: { status: number; corpo: string; nfseXml?: string; chaveAcesso?: string; numeroNfse?: string }) {
    await this.pool.query(`UPDATE fiscal_nfse_emissoes SET status = 'issued', processando_em = NULL, nfse_xml = ?, sefin_retorno = ?,
      sefin_http_status = ?, chave_acesso = ?, numero_nfse = ?, erro_codigo = NULL, erro_mensagem = NULL
      WHERE instituicao_id = ? AND id = ?`, [
      resposta.nfseXml ?? resposta.corpo, resposta.corpo, resposta.status, resposta.chaveAcesso ?? null, resposta.numeroNfse ?? null,
      instituicaoId(), emissaoId,
    ]);
  }

  async registrarFalha(emissaoId: string, falha: { status?: number; corpo?: string; codigo?: string; mensagem: string }) {
    await this.pool.query(`UPDATE fiscal_nfse_emissoes SET status = 'failed', processando_em = NULL, sefin_http_status = ?, sefin_retorno = ?,
      erro_codigo = ?, erro_mensagem = ? WHERE instituicao_id = ? AND id = ?`, [
      falha.status ?? null, falha.corpo ?? null, falha.codigo ?? null, falha.mensagem.slice(0, 1000), instituicaoId(), emissaoId,
    ]);
  }

  async eventos(emissaoId: string): Promise<readonly EventoNfse[]> {
    const [rows] = await this.pool.query<EventoRow[]>(`${SELECT_EVENTO} WHERE instituicao_id = ? AND emissao_id = ?
      ORDER BY criado_em`, [instituicaoId(), emissaoId]);
    return rows.map(toEvento);
  }

  /**
   * Reserva o sequencial do pedido de evento antes de falar com a SEFIN.
   *
   * O sequencial vem de `MAX + 1` dentro da transação, e a chave única da
   * tabela é quem decide o empate: dois cancelamentos simultâneos da mesma nota
   * calculam o mesmo número, e o segundo perde na gravação em vez de virar um
   * pedido duplicado no ambiente fiscal.
   */
  async reservarEvento(input: {
    emissaoId: string; tipoEvento: string; chaveAcesso: string;
    motivoCodigo?: string; motivo?: string; usuarioId: string;
  }): Promise<{ id: string; numeroPedido: number }> {
    const connection = await this.pool.getConnection();
    try {
      await connection.beginTransaction();
      const [maiores] = await connection.query<Array<RowDataPacket & { maior: number | null }>>(
        `SELECT MAX(numero_pedido) AS maior FROM fiscal_nfse_eventos
          WHERE instituicao_id = ? AND emissao_id = ? AND tipo_evento = ? FOR UPDATE`,
        [instituicaoId(), input.emissaoId, input.tipoEvento]
      );
      const numeroPedido = Number(maiores[0]?.maior ?? 0) + 1;
      const id = rowId('fiscal-nfse-evento', `${input.emissaoId}:${input.tipoEvento}:${numeroPedido}`);
      await connection.query(`INSERT INTO fiscal_nfse_eventos
        (id, instituicao_id, emissao_id, tipo_evento, numero_pedido, pedido_id, chave_acesso,
         motivo_codigo, motivo, status, solicitado_por_usuario_ref)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'processing', ?)`, [
        id, instituicaoId(), input.emissaoId, input.tipoEvento, numeroPedido, '', input.chaveAcesso,
        input.motivoCodigo ?? null, input.motivo?.slice(0, 255) ?? null, input.usuarioId,
      ]);
      await connection.commit();
      return { id, numeroPedido };
    } catch (error) {
      await connection.rollback();
      throw error;
    } finally {
      connection.release();
    }
  }

  async salvarPedidoEvento(eventoId: string, pedidoId: string, xmlAssinado: string) {
    await this.pool.query(`UPDATE fiscal_nfse_eventos SET pedido_id = ?, pedido_xml = ?
      WHERE instituicao_id = ? AND id = ?`, [pedidoId, xmlAssinado, instituicaoId(), eventoId]);
  }

  /**
   * Fecha o cancelamento: o evento vira `registered` e a emissão sai de
   * `issued`, na mesma transação. Meio caminho aqui é uma nota que a tela diz
   * estar válida e a prefeitura diz estar cancelada.
   */
  async registrarCancelamento(input: {
    emissaoId: string; eventoId: string; motivo: string;
    status: number; corpo: string;
  }) {
    const connection = await this.pool.getConnection();
    try {
      await connection.beginTransaction();
      await connection.query(`UPDATE fiscal_nfse_eventos SET status = 'registered', sefin_http_status = ?,
        sefin_retorno = ?, erro_codigo = NULL, erro_mensagem = NULL WHERE instituicao_id = ? AND id = ?`, [
        input.status, input.corpo, instituicaoId(), input.eventoId,
      ]);
      await connection.query(`UPDATE fiscal_nfse_emissoes SET status = 'cancelled',
        cancelado_em = CURRENT_TIMESTAMP(3), cancelamento_motivo = ? WHERE instituicao_id = ? AND id = ?`, [
        input.motivo.slice(0, 255), instituicaoId(), input.emissaoId,
      ]);
      await connection.commit();
    } catch (error) {
      await connection.rollback();
      throw error;
    } finally {
      connection.release();
    }
  }

  async registrarFalhaEvento(eventoId: string, falha: { status?: number; corpo?: string; codigo?: string; mensagem: string }) {
    await this.pool.query(`UPDATE fiscal_nfse_eventos SET status = 'failed', sefin_http_status = ?, sefin_retorno = ?,
      erro_codigo = ?, erro_mensagem = ? WHERE instituicao_id = ? AND id = ?`, [
      falha.status ?? null, falha.corpo ?? null, falha.codigo ?? null, falha.mensagem.slice(0, 1000), instituicaoId(), eventoId,
    ]);
  }
}
