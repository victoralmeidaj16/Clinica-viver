import 'server-only';

import { randomUUID } from 'node:crypto';
import type { RowDataPacket } from 'mysql2';
import { getMysqlPool } from '@/server/oci/runtime';
import { instituicaoId, rowId } from '@/server/persistence/mysql/mappers';
import { descricaoFiscalDaSessao } from '@/lib/sessionReference';

export type PaymentModality = 'social' | 'particular';

export interface ReservedCheckout {
  id: string;
  externalReference: string;
  chargeId: string;
  patientId: string;
  patientName: string;
  patientCpf: string;
  patientPhone?: string;
  patientEmail?: string;
  amountCents: number;
  professionalName: string;
  providerPaymentId?: string;
  description?: string;
  sessionStart?: string;
}

export interface SessionPaymentProfile {
  token: string;
  professionalName: string;
  sessionStart: string;
  amountCents: number;
  modality: PaymentModality;
  fundedByCompany: boolean;
  companyName?: string;
}

export interface CompanyFundedReservation {
  fundedByCompany: true;
  companyName?: string;
}

export type ChargeReservation = ReservedCheckout | CompanyFundedReservation;

export function isCompanyFundedReservation(value: ChargeReservation): value is CompanyFundedReservation {
  return 'fundedByCompany' in value && value.fundedByCompany === true;
}

function modalidadeDaTriagem(value: unknown): PaymentModality {
  return String(value ?? '').toLocaleUpperCase('pt-BR').includes('SOCIAL')
    ? 'social'
    : 'particular';
}

/** Cabeçalho público do link específico, sem expor a identidade do paciente. */
export async function getSessionPaymentProfile(
  token: string
): Promise<SessionPaymentProfile | null> {
  const [rows] = await getMysqlPool().query<RowDataPacket[]>(
    `SELECT a.token_pagamento_sessao, a.inicio, a.valor_centavos,
            p.nome AS profissional_nome, p.valor_social_centavos, p.valor_sessao_centavos,
            conv.nome AS convenio_nome,
            CASE WHEN pa.convenio_ref IS NULL THEN 0
                 ELSE COALESCE(pa.custeado_pela_empresa, conv.empresa_paga_sessoes, 1) END
              AS custeado_pela_empresa,
            (SELECT t.modalidade FROM clinica_triagens_pacientes t
              WHERE t.instituicao_id = a.instituicao_id
                AND t.organizacao_ref = o.ref_core AND t.paciente_ref = pa.ref_core
              ORDER BY t.atualizado_em DESC LIMIT 1) AS modalidade_triagem
       FROM clinica_agendamentos a
       JOIN clinica_profissionais p ON p.id = a.profissional_id
       JOIN clinica_organizacoes o ON o.id = a.organizacao_id
       JOIN clinica_pacientes pa ON pa.id = a.paciente_id
       LEFT JOIN clinica_convenios conv
         ON conv.instituicao_id = pa.instituicao_id AND conv.organizacao_ref = o.ref_core
        AND conv.ref_core = pa.convenio_ref
      WHERE a.instituicao_id = ? AND a.token_pagamento_sessao = ?
        AND a.status <> 'cancelado'
      LIMIT 1`,
    [instituicaoId(), token]
  );
  const row = rows[0];
  if (!row) return null;
  const modality = modalidadeDaTriagem(row.modalidade_triagem);
  const fallback = modality === 'social' ? row.valor_social_centavos : row.valor_sessao_centavos;
  return {
    token: String(row.token_pagamento_sessao),
    professionalName: String(row.profissional_nome),
    sessionStart: new Date(row.inicio).toISOString(),
    amountCents: Number(row.valor_centavos ?? fallback),
    modality,
    fundedByCompany: Boolean(row.custeado_pela_empresa),
    companyName: row.convenio_nome ? String(row.convenio_nome) : undefined,
  };
}

/**
 * Reserva a cobrança da sessão exata indicada pelo token.
 *
 * Diferente do link permanente, não procura "a última pendência" do paciente:
 * data, hora, checkout e futura NFS-e permanecem presos ao mesmo agendamento.
 */
export async function reserveAppointmentCharge(input: {
  token: string;
  cpf: string;
}): Promise<ChargeReservation | null> {
  const connection = await getMysqlPool().getConnection();
  try {
    await connection.beginTransaction();
    const [rows] = await connection.query<RowDataPacket[]>(
      `SELECT a.ref_core AS agendamento_ref, a.sessao_clinica_ref, a.inicio, a.valor_centavos,
              o.ref_core AS organizacao_ref, p.ref_core AS profissional_ref,
              p.nome AS profissional_nome, p.valor_social_centavos, p.valor_sessao_centavos,
              pa.ref_core AS paciente_ref, COALESCE(pa.nome_social, pa.nome) AS paciente_nome,
              conv.nome AS convenio_nome,
              CASE WHEN pa.convenio_ref IS NULL THEN 0
                   ELSE COALESCE(pa.custeado_pela_empresa, conv.empresa_paga_sessoes, 1) END
                AS custeado_pela_empresa,
              COALESCE(pa.documento, (SELECT t.cpf FROM clinica_triagens_pacientes t
                WHERE t.instituicao_id = a.instituicao_id AND t.organizacao_ref = o.ref_core
                  AND t.paciente_ref = pa.ref_core AND t.cpf IS NOT NULL
                ORDER BY t.atualizado_em DESC LIMIT 1)) AS paciente_cpf,
              COALESCE(pa.telefone, (SELECT t.telefone FROM clinica_triagens_pacientes t
                WHERE t.instituicao_id = a.instituicao_id AND t.organizacao_ref = o.ref_core
                  AND t.paciente_ref = pa.ref_core
                ORDER BY t.atualizado_em DESC LIMIT 1)) AS paciente_telefone,
              COALESCE(pa.email, (SELECT t.email FROM clinica_triagens_pacientes t
                WHERE t.instituicao_id = a.instituicao_id AND t.organizacao_ref = o.ref_core
                  AND t.paciente_ref = pa.ref_core AND t.email IS NOT NULL
                ORDER BY t.atualizado_em DESC LIMIT 1)) AS paciente_email,
              (SELECT t.modalidade FROM clinica_triagens_pacientes t
                WHERE t.instituicao_id = a.instituicao_id AND t.organizacao_ref = o.ref_core
                  AND t.paciente_ref = pa.ref_core
                ORDER BY t.atualizado_em DESC LIMIT 1) AS modalidade_triagem
         FROM clinica_agendamentos a
         JOIN clinica_profissionais p ON p.id = a.profissional_id
         JOIN clinica_organizacoes o ON o.id = a.organizacao_id
         JOIN clinica_pacientes pa ON pa.id = a.paciente_id
         LEFT JOIN clinica_convenios conv
           ON conv.instituicao_id = pa.instituicao_id AND conv.organizacao_ref = o.ref_core
          AND conv.ref_core = pa.convenio_ref
        WHERE a.instituicao_id = ? AND a.token_pagamento_sessao = ?
          AND a.status <> 'cancelado'
          AND (
            REPLACE(REPLACE(REPLACE(COALESCE(pa.documento, ''), '.', ''), '-', ''), ' ', '') = ?
            OR EXISTS (
              SELECT 1 FROM clinica_triagens_pacientes tc
               WHERE tc.instituicao_id = a.instituicao_id
                 AND tc.organizacao_ref = o.ref_core AND tc.paciente_ref = pa.ref_core
                 AND REPLACE(REPLACE(REPLACE(COALESCE(tc.cpf, ''), '.', ''), '-', ''), ' ', '') = ?
            )
          )
        LIMIT 1 FOR UPDATE`,
      [instituicaoId(), input.token, input.cpf, input.cpf]
    );
    const appointment = rows[0];
    if (!appointment) {
      await connection.rollback();
      return null;
    }
    if (Boolean(appointment.custeado_pela_empresa)) {
      await connection.commit();
      return {
        fundedByCompany: true,
        companyName: appointment.convenio_nome ? String(appointment.convenio_nome) : undefined,
      };
    }

    const modality = modalidadeDaTriagem(appointment.modalidade_triagem);
    const fallback = modality === 'social'
      ? appointment.valor_social_centavos
      : appointment.valor_sessao_centavos;
    const amountCents = Number(appointment.valor_centavos ?? fallback);
    if (!Number.isInteger(amountCents) || amountCents <= 0) {
      throw new Error('O valor desta sessão não está configurado no perfil profissional.');
    }
    const sessionStart = new Date(appointment.inicio).toISOString();
    const description = descricaoFiscalDaSessao(sessionStart);

    const [chargeRows] = await connection.query<RowDataPacket[]>(
      `SELECT c.ref_core AS cobranca_ref, x.id AS checkout_ref,
              x.referencia_externa, x.provedor_pagamento_ref
         FROM financeiro_cobrancas c
         LEFT JOIN financeiro_checkouts_asaas x
           ON x.instituicao_id = c.instituicao_id AND x.cobranca_ref = c.ref_core
        WHERE c.instituicao_id = ? AND c.organizacao_ref = ?
          AND c.sessao_ref IN (?, ?)
        ORDER BY c.criado_em DESC LIMIT 1 FOR UPDATE`,
      [instituicaoId(), appointment.organizacao_ref, appointment.agendamento_ref,
        appointment.sessao_clinica_ref ?? appointment.agendamento_ref]
    );

    let chargeRef = chargeRows[0]?.cobranca_ref
      ? String(chargeRows[0].cobranca_ref)
      : undefined;
    if (!chargeRef) {
      chargeRef = `charge-session-${randomUUID()}`;
      const billingSessionRef = String(
        appointment.sessao_clinica_ref || appointment.agendamento_ref
      );
      await connection.execute(
        `INSERT INTO financeiro_cobrancas
           (id, instituicao_id, organizacao_ref, ref_core, sessao_ref, paciente_ref,
            profissional_ref, emitida_em, vence_em, valor_centavos, status,
            descricao, criado_em, atualizado_em)
         VALUES (?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP(3), CURRENT_TIMESTAMP(3),
                 ?, 'pending', ?, CURRENT_TIMESTAMP(3), CURRENT_TIMESTAMP(3))`,
        [rowId('cobranca', chargeRef), instituicaoId(), appointment.organizacao_ref,
          chargeRef, billingSessionRef, appointment.paciente_ref,
          appointment.profissional_ref, amountCents, description]
      );
    }

    const checkoutId = chargeRows[0]?.checkout_ref
      ? String(chargeRows[0].checkout_ref)
      : randomUUID();
    const externalReference = chargeRows[0]?.referencia_externa
      ? String(chargeRows[0].referencia_externa)
      : `VM-${checkoutId.replaceAll('-', '')}`;
    if (!chargeRows[0]?.checkout_ref) {
      await connection.execute(
        `INSERT INTO financeiro_checkouts_asaas
           (id, instituicao_id, organizacao_ref, cobranca_ref, modalidade, referencia_externa)
         VALUES (?, ?, ?, ?, ?, ?)`,
        [rowId('checkout', checkoutId), instituicaoId(), appointment.organizacao_ref,
          chargeRef, modality, externalReference]
      );
    }
    if (appointment.sessao_clinica_ref) {
      await connection.execute(
        `UPDATE clinica_sessoes
            SET cobranca_ref = ?, atualizado_em = CURRENT_TIMESTAMP(3)
          WHERE instituicao_id = ? AND organizacao_ref = ? AND ref_core = ?
            AND cobranca_ref IS NULL`,
        [chargeRef, instituicaoId(), appointment.organizacao_ref,
          appointment.sessao_clinica_ref]
      );
    }

    await connection.commit();
    return {
      id: checkoutId,
      externalReference,
      chargeId: chargeRef,
      patientId: String(appointment.paciente_ref),
      patientName: String(appointment.paciente_nome),
      patientCpf: String(appointment.paciente_cpf).replace(/\D/g, ''),
      patientPhone: appointment.paciente_telefone ? String(appointment.paciente_telefone) : undefined,
      patientEmail: appointment.paciente_email ? String(appointment.paciente_email) : undefined,
      amountCents,
      professionalName: String(appointment.profissional_nome),
      providerPaymentId: chargeRows[0]?.provedor_pagamento_ref
        ? String(chargeRows[0].provedor_pagamento_ref)
        : undefined,
      description,
      sessionStart,
    };
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
}

export interface PagamentoRecebido {
  ref: string;
  patientName: string;
  amountCents: number;
  receivedAt: string;
  method: string;
}

/**
 * Pagamentos conciliados dos pacientes de um profissional.
 *
 * Alimenta o sino. A conciliação já grava o fato em `financeiro_pagamentos`
 * quando o webhook do Asaas chega, então o aviso é derivado dessa linha em vez
 * de escrito por um segundo caminho — a mesma escolha que o resto das
 * notificações faz, e a razão pela qual "seu paciente pagou" não pode aparecer
 * para uma cobrança que foi estornada depois.
 */
export async function listRecentConfirmedPayments(
  organizationId: string,
  professionalId: string,
  desde: Date
): Promise<PagamentoRecebido[]> {
  const [rows] = await getMysqlPool().query<RowDataPacket[]>(
    `SELECT g.ref_core, g.recebido_em, g.valor_centavos, g.forma,
            COALESCE(pa.nome_social, pa.nome) AS paciente_nome
       FROM financeiro_pagamentos g
       JOIN financeiro_cobrancas c
         ON c.instituicao_id = g.instituicao_id AND c.ref_core = g.cobranca_ref
       LEFT JOIN clinica_pacientes pa
         ON pa.instituicao_id = c.instituicao_id AND pa.ref_core = c.paciente_ref
      WHERE g.instituicao_id = ? AND g.organizacao_ref = ? AND c.profissional_ref = ?
        AND g.status = 'confirmed' AND g.recebido_em >= ?
      ORDER BY g.recebido_em DESC
      LIMIT 40`,
    [instituicaoId(), organizationId, professionalId, desde]
  );
  return rows.map((row) => ({
    ref: String(row.ref_core),
    patientName: String(row.paciente_nome ?? 'Paciente'),
    amountCents: Number(row.valor_centavos),
    receivedAt: new Date(row.recebido_em).toISOString(),
    method: String(row.forma ?? 'other'),
  }));
}

export async function bindProviderPayment(
  checkout: ReservedCheckout,
  providerPaymentId: string,
  method: 'pix' | 'card' | 'other'
): Promise<void> {
  const connection = await getMysqlPool().getConnection();
  try {
    await connection.beginTransaction();
    await connection.execute(
      `UPDATE financeiro_checkouts_asaas
          SET provedor_pagamento_ref = ?, status = 'pending', erro_codigo = NULL
        WHERE instituicao_id = ? AND referencia_externa = ?`,
      [providerPaymentId, instituicaoId(), checkout.externalReference]
    );
    await connection.execute(
      `UPDATE financeiro_cobrancas
          SET provedor_ref = ?, forma_pagamento = ?, atualizado_em = CURRENT_TIMESTAMP(3)
        WHERE instituicao_id = ? AND ref_core = ? AND provedor_ref IS NULL`,
      [providerPaymentId, method, instituicaoId(), checkout.chargeId]
    );
    await connection.commit();
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
}

export async function reconcileAsaasPayment(input: {
  eventId: string;
  eventType: string;
  paymentId: string;
  amountCents: number;
  receivedAt: string;
  billingType: string;
}): Promise<'processed' | 'duplicate' | 'unknown'> {
  const connection = await getMysqlPool().getConnection();
  try {
    await connection.beginTransaction();
    const [chargeRows] = await connection.query<RowDataPacket[]>(
      `SELECT organizacao_ref, ref_core, valor_centavos
         FROM financeiro_cobrancas
        WHERE instituicao_id = ? AND provedor_ref = ? LIMIT 1 FOR UPDATE`,
      [instituicaoId(), input.paymentId]
    );
    const charge = chargeRows[0];
    if (!charge) {
      await connection.rollback();
      return 'unknown';
    }
    const [existing] = await connection.query<RowDataPacket[]>(
      `SELECT id FROM financeiro_webhooks_asaas
        WHERE instituicao_id = ? AND evento_ref = ? LIMIT 1`,
      [instituicaoId(), input.eventId]
    );
    if (existing[0]) {
      await connection.rollback();
      return 'duplicate';
    }
    await connection.execute(
      `INSERT INTO financeiro_webhooks_asaas
         (id, instituicao_id, evento_ref, evento_tipo, provedor_pagamento_ref)
       VALUES (?, ?, ?, ?, ?)`,
      [rowId('asaas_event', input.eventId), instituicaoId(), input.eventId,
        input.eventType, input.paymentId]
    );
    const paymentRef = `asaas-${input.paymentId}`;
    const paymentMethod = input.billingType === 'PIX'
      ? 'pix'
      : input.billingType === 'CREDIT_CARD' ? 'card' : 'other';
    await connection.execute(
      `INSERT INTO financeiro_pagamentos
         (id, instituicao_id, organizacao_ref, ref_core, cobranca_ref, recebido_em,
          valor_centavos, forma, status, provedor, provedor_transacao_ref)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'confirmed', 'asaas', ?)
       ON DUPLICATE KEY UPDATE recebido_em = VALUES(recebido_em),
         valor_centavos = VALUES(valor_centavos), forma = VALUES(forma), status = 'confirmed'`,
      [rowId('pagamento', paymentRef), instituicaoId(), charge.organizacao_ref,
        paymentRef, charge.ref_core, input.receivedAt, input.amountCents,
        paymentMethod, input.paymentId]
    );
    const nextStatus = input.amountCents >= Number(charge.valor_centavos)
      ? 'paid'
      : 'partially_paid';
    await connection.execute(
      `UPDATE financeiro_cobrancas SET status = ?, forma_pagamento = ?, atualizado_em = CURRENT_TIMESTAMP(3)
        WHERE instituicao_id = ? AND ref_core = ?`,
      [nextStatus, paymentMethod, instituicaoId(), charge.ref_core]
    );
    await connection.execute(
      `UPDATE financeiro_checkouts_asaas SET status = 'paid'
        WHERE instituicao_id = ? AND provedor_pagamento_ref = ?`,
      [instituicaoId(), input.paymentId]
    );
    await connection.commit();
    return 'processed';
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
}
