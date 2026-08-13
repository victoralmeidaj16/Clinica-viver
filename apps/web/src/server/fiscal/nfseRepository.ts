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
  };
}

const SELECT = `SELECT id, cobranca_ref, paciente_ref, cnpj_prestador, serie, numero_dps, dps_id,
  ambiente, valor_centavos, competencia, status, idempotency_key, dps_xml, nfse_xml,
  chave_acesso, numero_nfse, sefin_http_status, sefin_retorno, erro_codigo, erro_mensagem
  FROM fiscal_nfse_emissoes`;

export function exigirPersistenciaFiscal() {
  if (!isMysqlConfigured()) throw new Error('A emissão de NFS-e exige o MySQL configurado para registrar a DPS e evitar duplicidade.');
}

export class NfseRepository {
  constructor(private readonly pool: Pool = getMysqlPool()) {}

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
}
