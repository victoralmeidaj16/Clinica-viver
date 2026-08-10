import 'server-only';

import type { RowDataPacket } from 'mysql2';
import type { Pool } from 'mysql2/promise';
import type {
  ChargeStatus,
  FinancialCharge,
  FinancialDiscount,
  FinancialFee,
  FinancialFilter,
  FinancialLedger,
  FinancialPayment,
  FinancialRefund,
  FinancialRepository,
  FinancialTransfer,
  PaymentMethod,
} from '@thats-life/core';
import { getMysqlPool } from '@/server/oci/runtime';
import { fromSqlTimestamp, instituicaoId, rowId, toSqlTimestamp } from './mappers';

/**
 * Razão financeiro no MySQL.
 *
 * Seis coleções, seis tabelas, uma por tipo de fato — cobrança, desconto,
 * pagamento, estorno, taxa e repasse. Nenhuma delas guarda saldo: o saldo é
 * derivado pela conciliação em `packages/core/src/financial/reconciliation.ts`,
 * e um total gravado é um total que envelhece sozinho.
 *
 * Valores trafegam em centavos inteiros do começo ao fim. `BIGINT` no banco,
 * `MoneyCents` no domínio, nenhuma conversão para decimal no caminho: é assim
 * que não se introduz erro de arredondamento em dinheiro.
 *
 * O `organizationId` do filtro é opcional no domínio, mas aqui é obrigatório —
 * ler o razão de todas as organizações de uma vez não é caso de uso, é
 * vazamento entre clínicas.
 */

interface CobrancaRow extends RowDataPacket {
  ref_core: string;
  organizacao_ref: string;
  sessao_ref: string;
  paciente_ref: string;
  profissional_ref: string;
  emitida_em: string;
  vence_em: string;
  valor_centavos: number;
  status: ChargeStatus;
  forma_pagamento: PaymentMethod | null;
  descricao: string | null;
  provedor_ref: string | null;
  criado_em: string;
  atualizado_em: string;
}

function toCharge(row: CobrancaRow): FinancialCharge {
  return {
    id: row.ref_core,
    organizationId: row.organizacao_ref,
    sessionId: row.sessao_ref,
    patientId: row.paciente_ref,
    professionalId: row.profissional_ref,
    issuedAt: fromSqlTimestamp(row.emitida_em) ?? new Date(0).toISOString(),
    dueAt: fromSqlTimestamp(row.vence_em) ?? new Date(0).toISOString(),
    amountCents: Number(row.valor_centavos),
    status: row.status,
    paymentMethod: row.forma_pagamento ?? undefined,
    description: row.descricao ?? undefined,
    providerReference: row.provedor_ref ?? undefined,
    createdAt: fromSqlTimestamp(row.criado_em) ?? new Date(0).toISOString(),
    updatedAt: fromSqlTimestamp(row.atualizado_em) ?? new Date(0).toISOString(),
  };
}

const COBRANCA_SELECT = `
  SELECT ref_core, organizacao_ref, sessao_ref, paciente_ref, profissional_ref,
         emitida_em, vence_em, valor_centavos, status, forma_pagamento, descricao,
         provedor_ref, criado_em, atualizado_em
    FROM financeiro_cobrancas
   WHERE instituicao_id = ?`;

export class MysqlFinancialRepository implements FinancialRepository {
  constructor(private readonly pool: Pool = getMysqlPool()) {}

  /**
   * Monta o razão do período.
   *
   * As coleções filhas são lidas pelas referências das cobranças já
   * selecionadas, e não por um `JOIN` gigante: cada uma volta na sua consulta,
   * o que mantém a leitura previsível quando o histórico cresce e evita
   * multiplicar linhas de pagamento por linhas de desconto.
   */
  async getLedger(filter: FinancialFilter): Promise<FinancialLedger> {
    const vazio: FinancialLedger = {
      charges: [],
      discounts: [],
      payments: [],
      refunds: [],
      fees: [],
      transfers: [],
    };

    if (!filter.organizationId) return vazio;

    const clauses: string[] = ['organizacao_ref = ?'];
    const params: unknown[] = [instituicaoId(), filter.organizationId];

    if (filter.startDate) {
      clauses.push('emitida_em >= ?');
      params.push(toSqlTimestamp(filter.startDate));
    }
    if (filter.endDate) {
      clauses.push('emitida_em <= ?');
      params.push(toSqlTimestamp(filter.endDate));
    }
    if (filter.patientIds?.length) {
      clauses.push('paciente_ref IN (?)');
      params.push([...filter.patientIds]);
    }
    if (filter.professionalIds?.length) {
      clauses.push('profissional_ref IN (?)');
      params.push([...filter.professionalIds]);
    }
    if (filter.chargeStatuses?.length) {
      clauses.push('status IN (?)');
      params.push([...filter.chargeStatuses]);
    }
    if (filter.paymentMethods?.length) {
      clauses.push('forma_pagamento IN (?)');
      params.push([...filter.paymentMethods]);
    }

    const [cobrancaRows] = await this.pool.query<CobrancaRow[]>(
      `${COBRANCA_SELECT}${clauses.map((c) => ` AND ${c}`).join('')} ORDER BY emitida_em`,
      params
    );

    const charges = cobrancaRows.map(toCharge);
    if (charges.length === 0) return vazio;

    const chargeRefs = charges.map((charge) => charge.id);
    const escopo = [instituicaoId(), filter.organizationId];

    const [descontoRows] = await this.pool.query<RowDataPacket[]>(
      `SELECT ref_core, cobranca_ref, valor_centavos, motivo, aplicado_em, criado_por
         FROM financeiro_descontos
        WHERE instituicao_id = ? AND organizacao_ref = ? AND cobranca_ref IN (?)`,
      [...escopo, chargeRefs]
    );
    const [pagamentoRows] = await this.pool.query<RowDataPacket[]>(
      `SELECT ref_core, cobranca_ref, recebido_em, valor_centavos, forma, status,
              provedor, provedor_transacao_ref
         FROM financeiro_pagamentos
        WHERE instituicao_id = ? AND organizacao_ref = ? AND cobranca_ref IN (?)`,
      [...escopo, chargeRefs]
    );
    const [repasseRows] = await this.pool.query<RowDataPacket[]>(
      `SELECT ref_core, cobranca_ref, profissional_ref, valor_centavos, vence_em,
              status, pago_em, provedor_ref
         FROM financeiro_repasses
        WHERE instituicao_id = ? AND organizacao_ref = ? AND cobranca_ref IN (?)`,
      [...escopo, chargeRefs]
    );

    const payments: FinancialPayment[] = (pagamentoRows as Array<Record<string, never>>).map(
      (row: Record<string, unknown>) => ({
        id: row.ref_core as string,
        chargeId: row.cobranca_ref as string,
        receivedAt: fromSqlTimestamp(row.recebido_em as string) ?? new Date(0).toISOString(),
        amountCents: Number(row.valor_centavos),
        method: row.forma as PaymentMethod,
        status: row.status as FinancialPayment['status'],
        provider: (row.provedor as FinancialPayment['provider']) ?? undefined,
        providerTransactionId: (row.provedor_transacao_ref as string) ?? undefined,
      })
    );

    // Estorno e taxa pendem de pagamento, não só de cobrança: sem os pagamentos
    // em mãos não há como delimitar quais deles pertencem a este período. Por
    // isso as duas consultas vêm depois, e não antes.
    const paymentRefs = payments.map((payment) => payment.id);

    const [estornoRows] = paymentRefs.length
      ? await this.pool.query<RowDataPacket[]>(
          `SELECT ref_core, pagamento_ref, valor_centavos, estornado_em, motivo, provedor_ref
             FROM financeiro_estornos
            WHERE instituicao_id = ? AND organizacao_ref = ? AND pagamento_ref IN (?)`,
          [...escopo, paymentRefs]
        )
      : [[] as RowDataPacket[]];

    // Uma taxa nasce de uma cobrança ou de um pagamento. As duas pontas são
    // delimitadas pelo que já foi selecionado — filtrar por "tem pagamento"
    // traria taxas de qualquer período.
    const [taxaRows] = await this.pool.query<RowDataPacket[]>(
      `SELECT ref_core, cobranca_ref, pagamento_ref, tipo, valor_centavos, incorrida_em, descricao
         FROM financeiro_taxas
        WHERE instituicao_id = ? AND organizacao_ref = ?
          AND (cobranca_ref IN (?)${paymentRefs.length ? ' OR pagamento_ref IN (?)' : ''})`,
      paymentRefs.length ? [...escopo, chargeRefs, paymentRefs] : [...escopo, chargeRefs]
    );

    return {
      charges,
      discounts: (descontoRows as Array<Record<string, unknown>>).map(
        (row): FinancialDiscount => ({
          id: row.ref_core as string,
          chargeId: row.cobranca_ref as string,
          amountCents: Number(row.valor_centavos),
          reason: row.motivo as string,
          appliedAt: fromSqlTimestamp(row.aplicado_em as string) ?? new Date(0).toISOString(),
          createdBy: row.criado_por as string,
        })
      ),
      payments,
      refunds: (estornoRows as Array<Record<string, unknown>>).map(
        (row): FinancialRefund => ({
          id: row.ref_core as string,
          paymentId: row.pagamento_ref as string,
          amountCents: Number(row.valor_centavos),
          refundedAt: fromSqlTimestamp(row.estornado_em as string) ?? new Date(0).toISOString(),
          reason: row.motivo as string,
          providerReference: (row.provedor_ref as string) ?? undefined,
        })
      ),
      fees: (taxaRows as Array<Record<string, unknown>>).map(
        (row): FinancialFee => ({
          id: row.ref_core as string,
          chargeId: (row.cobranca_ref as string) ?? undefined,
          paymentId: (row.pagamento_ref as string) ?? undefined,
          organizationId: filter.organizationId!,
          type: row.tipo as FinancialFee['type'],
          amountCents: Number(row.valor_centavos),
          incurredAt: fromSqlTimestamp(row.incorrida_em as string) ?? new Date(0).toISOString(),
          description: row.descricao as string,
        })
      ),
      transfers: (repasseRows as Array<Record<string, unknown>>).map(
        (row): FinancialTransfer => ({
          id: row.ref_core as string,
          chargeId: row.cobranca_ref as string,
          professionalId: row.profissional_ref as string,
          amountCents: Number(row.valor_centavos),
          dueAt: fromSqlTimestamp(row.vence_em as string) ?? new Date(0).toISOString(),
          status: row.status as FinancialTransfer['status'],
          paidAt: fromSqlTimestamp(row.pago_em as string | null),
          providerReference: (row.provedor_ref as string) ?? undefined,
        })
      ),
    };
  }

  async getChargeById(id: string): Promise<FinancialCharge | null> {
    const [rows] = await this.pool.query<CobrancaRow[]>(`${COBRANCA_SELECT} AND ref_core = ?`, [
      instituicaoId(),
      id,
    ]);
    return rows[0] ? toCharge(rows[0]) : null;
  }

  /**
   * Caminho do webhook do gateway.
   *
   * A unicidade de `provedor_ref` no banco é o que garante que esta busca
   * devolva uma cobrança e não duas — conciliar a errada seria dar baixa no
   * pagamento de outra pessoa.
   */
  async getChargeByProviderReference(reference: string): Promise<FinancialCharge | null> {
    const [rows] = await this.pool.query<CobrancaRow[]>(`${COBRANCA_SELECT} AND provedor_ref = ?`, [
      instituicaoId(),
      reference,
    ]);
    return rows[0] ? toCharge(rows[0]) : null;
  }

  async saveCharge(charge: FinancialCharge): Promise<void> {
    await this.pool.execute(
      `INSERT INTO financeiro_cobrancas
         (id, instituicao_id, organizacao_ref, ref_core, sessao_ref, paciente_ref,
          profissional_ref, emitida_em, vence_em, valor_centavos, status,
          forma_pagamento, descricao, provedor_ref, criado_em, atualizado_em)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
       ON DUPLICATE KEY UPDATE
         sessao_ref = VALUES(sessao_ref), paciente_ref = VALUES(paciente_ref),
         profissional_ref = VALUES(profissional_ref), emitida_em = VALUES(emitida_em),
         vence_em = VALUES(vence_em), valor_centavos = VALUES(valor_centavos),
         status = VALUES(status), forma_pagamento = VALUES(forma_pagamento),
         descricao = VALUES(descricao), provedor_ref = VALUES(provedor_ref),
         atualizado_em = VALUES(atualizado_em)`,
      [
        rowId('cobranca', charge.id),
        instituicaoId(),
        charge.organizationId,
        charge.id,
        charge.sessionId,
        charge.patientId,
        charge.professionalId,
        toSqlTimestamp(charge.issuedAt),
        toSqlTimestamp(charge.dueAt),
        charge.amountCents,
        charge.status,
        charge.paymentMethod ?? null,
        charge.description ?? null,
        charge.providerReference ?? null,
        toSqlTimestamp(charge.createdAt),
        toSqlTimestamp(charge.updatedAt),
      ]
    );
  }

  async saveDiscount(discount: FinancialDiscount): Promise<void> {
    await this.pool.execute(
      `INSERT INTO financeiro_descontos
         (id, instituicao_id, organizacao_ref, ref_core, cobranca_ref, valor_centavos,
          motivo, aplicado_em, criado_por)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
       ON DUPLICATE KEY UPDATE
         valor_centavos = VALUES(valor_centavos), motivo = VALUES(motivo),
         aplicado_em = VALUES(aplicado_em), criado_por = VALUES(criado_por)`,
      [
        rowId('desconto', discount.id),
        instituicaoId(),
        await this.organizacaoDaCobranca(discount.chargeId),
        discount.id,
        discount.chargeId,
        discount.amountCents,
        discount.reason,
        toSqlTimestamp(discount.appliedAt),
        discount.createdBy,
      ]
    );
  }

  async savePayment(payment: FinancialPayment): Promise<void> {
    await this.pool.execute(
      `INSERT INTO financeiro_pagamentos
         (id, instituicao_id, organizacao_ref, ref_core, cobranca_ref, recebido_em,
          valor_centavos, forma, status, provedor, provedor_transacao_ref)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
       ON DUPLICATE KEY UPDATE
         recebido_em = VALUES(recebido_em), valor_centavos = VALUES(valor_centavos),
         forma = VALUES(forma), status = VALUES(status), provedor = VALUES(provedor),
         provedor_transacao_ref = VALUES(provedor_transacao_ref)`,
      [
        rowId('pagamento', payment.id),
        instituicaoId(),
        await this.organizacaoDaCobranca(payment.chargeId),
        payment.id,
        payment.chargeId,
        toSqlTimestamp(payment.receivedAt),
        payment.amountCents,
        payment.method,
        payment.status,
        payment.provider ?? null,
        payment.providerTransactionId ?? null,
      ]
    );
  }

  async saveRefund(refund: FinancialRefund): Promise<void> {
    await this.pool.execute(
      `INSERT INTO financeiro_estornos
         (id, instituicao_id, organizacao_ref, ref_core, pagamento_ref, valor_centavos,
          estornado_em, motivo, provedor_ref)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
       ON DUPLICATE KEY UPDATE
         valor_centavos = VALUES(valor_centavos), estornado_em = VALUES(estornado_em),
         motivo = VALUES(motivo), provedor_ref = VALUES(provedor_ref)`,
      [
        rowId('estorno', refund.id),
        instituicaoId(),
        await this.organizacaoDoPagamento(refund.paymentId),
        refund.id,
        refund.paymentId,
        refund.amountCents,
        toSqlTimestamp(refund.refundedAt),
        refund.reason,
        refund.providerReference ?? null,
      ]
    );
  }

  async saveFee(fee: FinancialFee): Promise<void> {
    await this.pool.execute(
      `INSERT INTO financeiro_taxas
         (id, instituicao_id, organizacao_ref, ref_core, cobranca_ref, pagamento_ref,
          tipo, valor_centavos, incorrida_em, descricao)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
       ON DUPLICATE KEY UPDATE
         cobranca_ref = VALUES(cobranca_ref), pagamento_ref = VALUES(pagamento_ref),
         tipo = VALUES(tipo), valor_centavos = VALUES(valor_centavos),
         incorrida_em = VALUES(incorrida_em), descricao = VALUES(descricao)`,
      [
        rowId('taxa', fee.id),
        instituicaoId(),
        fee.organizationId,
        fee.id,
        fee.chargeId ?? null,
        fee.paymentId ?? null,
        fee.type,
        fee.amountCents,
        toSqlTimestamp(fee.incurredAt),
        fee.description,
      ]
    );
  }

  async saveTransfer(transfer: FinancialTransfer): Promise<void> {
    await this.pool.execute(
      `INSERT INTO financeiro_repasses
         (id, instituicao_id, organizacao_ref, ref_core, cobranca_ref, profissional_ref,
          valor_centavos, vence_em, status, pago_em, provedor_ref)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
       ON DUPLICATE KEY UPDATE
         profissional_ref = VALUES(profissional_ref), valor_centavos = VALUES(valor_centavos),
         vence_em = VALUES(vence_em), status = VALUES(status), pago_em = VALUES(pago_em),
         provedor_ref = VALUES(provedor_ref)`,
      [
        rowId('repasse', transfer.id),
        instituicaoId(),
        await this.organizacaoDaCobranca(transfer.chargeId),
        transfer.id,
        transfer.chargeId,
        transfer.professionalId,
        transfer.amountCents,
        toSqlTimestamp(transfer.dueAt),
        transfer.status,
        transfer.paidAt ? toSqlTimestamp(transfer.paidAt) : null,
        transfer.providerReference ?? null,
      ]
    );
  }

  /**
   * Desconto, pagamento e repasse não carregam a organização no domínio — ela
   * vem da cobrança a que pertencem. Resolver aqui evita gravar a linha filha
   * num escopo diferente do pai, que é como um relatório de uma clínica passa a
   * somar o dinheiro de outra.
   */
  private async organizacaoDaCobranca(chargeId: string): Promise<string> {
    const [rows] = await this.pool.query<RowDataPacket[]>(
      'SELECT organizacao_ref FROM financeiro_cobrancas WHERE instituicao_id = ? AND ref_core = ?',
      [instituicaoId(), chargeId]
    );
    const ref = (rows as Array<{ organizacao_ref: string }>)[0]?.organizacao_ref;
    if (!ref) throw new Error(`Cobrança ${chargeId} não encontrada para vincular o lançamento.`);
    return ref;
  }

  private async organizacaoDoPagamento(paymentId: string): Promise<string> {
    const [rows] = await this.pool.query<RowDataPacket[]>(
      'SELECT organizacao_ref FROM financeiro_pagamentos WHERE instituicao_id = ? AND ref_core = ?',
      [instituicaoId(), paymentId]
    );
    const ref = (rows as Array<{ organizacao_ref: string }>)[0]?.organizacao_ref;
    if (!ref) throw new Error(`Pagamento ${paymentId} não encontrado para vincular o estorno.`);
    return ref;
  }
}
