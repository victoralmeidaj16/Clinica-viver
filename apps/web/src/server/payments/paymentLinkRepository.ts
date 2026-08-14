import 'server-only';

import { randomUUID } from 'node:crypto';
import type { RowDataPacket } from 'mysql2';
import { getMysqlPool } from '@/server/oci/runtime';
import { instituicaoId, rowId } from '@/server/persistence/mysql/mappers';

export type PaymentModality = 'social' | 'particular';

export interface PaymentProfile {
  token: string;
  organizationId: string;
  professionalId: string;
  professionalName: string;
  socialCents: number;
  privateCents: number;
}

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
}

interface ProfileRow extends RowDataPacket {
  token_link_pagamento: string;
  organizacao_ref: string;
  ref_core: string;
  nome: string;
  valor_social_centavos: number;
  valor_sessao_centavos: number;
}

function profile(row: ProfileRow): PaymentProfile {
  return {
    token: row.token_link_pagamento,
    organizationId: row.organizacao_ref,
    professionalId: row.ref_core,
    professionalName: row.nome,
    socialCents: Number(row.valor_social_centavos),
    privateCents: Number(row.valor_sessao_centavos),
  };
}

const PROFILE_SELECT = `
  SELECT p.token_link_pagamento, o.ref_core AS organizacao_ref, p.ref_core, p.nome,
         p.valor_social_centavos, p.valor_sessao_centavos
    FROM clinica_profissionais p
    JOIN clinica_organizacoes o ON o.id = p.organizacao_id
   WHERE p.instituicao_id = ? AND p.ativo = 1`;

export async function getPublicPaymentProfile(token: string): Promise<PaymentProfile | null> {
  const [rows] = await getMysqlPool().query<ProfileRow[]>(
    `${PROFILE_SELECT} AND p.token_link_pagamento = ? LIMIT 1`,
    [instituicaoId(), token]
  );
  return rows[0] ? profile(rows[0]) : null;
}

export async function getProfessionalPaymentProfile(
  organizationId: string,
  professionalId: string
): Promise<PaymentProfile | null> {
  const pool = getMysqlPool();
  let [rows] = await pool.query<ProfileRow[]>(
    `${PROFILE_SELECT} AND o.ref_core = ? AND p.ref_core = ? LIMIT 1`,
    [instituicaoId(), organizationId, professionalId]
  );
  if (!rows[0]) return null;
  if (!rows[0].token_link_pagamento) {
    const token = randomUUID().replaceAll('-', '');
    await pool.execute(
      `UPDATE clinica_profissionais SET token_link_pagamento = ?
        WHERE instituicao_id = ? AND ref_core = ? AND token_link_pagamento IS NULL`,
      [token, instituicaoId(), professionalId]
    );
    [rows] = await pool.query<ProfileRow[]>(
      `${PROFILE_SELECT} AND o.ref_core = ? AND p.ref_core = ? LIMIT 1`,
      [instituicaoId(), organizationId, professionalId]
    );
  }
  return rows[0] ? profile(rows[0]) : null;
}

export async function reservePendingCharge(input: {
  token: string;
  modality: PaymentModality;
  cpf: string;
}): Promise<ReservedCheckout | null> {
  const connection = await getMysqlPool().getConnection();
  try {
    await connection.beginTransaction();
    const amountColumn = input.modality === 'social'
      ? 'p.valor_social_centavos'
      : 'p.valor_sessao_centavos';
    const [patientRows] = await connection.query<RowDataPacket[]>(
      `SELECT o.ref_core AS organizacao_ref, p.ref_core AS profissional_ref,
              p.nome AS profissional_nome, ${amountColumn} AS valor_centavos,
              pa.ref_core AS paciente_ref, t.nome_paciente, t.cpf, t.telefone, t.email
         FROM clinica_profissionais p
         JOIN clinica_organizacoes o ON o.id = p.organizacao_id
         JOIN clinica_triagens_pacientes t
           ON t.instituicao_id = p.instituicao_id AND t.organizacao_ref = o.ref_core
          AND t.paciente_ref IS NOT NULL
         JOIN clinica_pacientes pa
           ON pa.instituicao_id = t.instituicao_id AND pa.ref_core = t.paciente_ref
        WHERE p.instituicao_id = ? AND p.token_link_pagamento = ? AND p.ativo = 1
          AND REPLACE(REPLACE(REPLACE(t.cpf, '.', ''), '-', ''), ' ', '') = ?
          AND (pa.profissional_id = p.id OR EXISTS (
            SELECT 1 FROM clinica_pacientes_profissionais pp
             WHERE pp.paciente_id = pa.id AND pp.profissional_id = p.id
          ))
        ORDER BY t.atualizado_em DESC
        LIMIT 1 FOR UPDATE`,
      [instituicaoId(), input.token, input.cpf]
    );
    const patient = patientRows[0];
    if (!patient) {
      await connection.rollback();
      return null;
    }

    const [chargeRows] = await connection.query<RowDataPacket[]>(
      `SELECT c.ref_core AS cobranca_ref, x.id AS checkout_ref,
              x.referencia_externa, x.provedor_pagamento_ref
         FROM financeiro_cobrancas c
         LEFT JOIN financeiro_checkouts_asaas x
           ON x.instituicao_id = c.instituicao_id AND x.cobranca_ref = c.ref_core
        WHERE c.instituicao_id = ? AND c.organizacao_ref = ?
          AND c.profissional_ref = ? AND c.paciente_ref = ?
          AND c.valor_centavos = ? AND c.status IN ('pending', 'overdue')
        ORDER BY c.criado_em DESC LIMIT 1 FOR UPDATE`,
      [instituicaoId(), patient.organizacao_ref, patient.profissional_ref,
        patient.paciente_ref, Number(patient.valor_centavos)]
    );
    let charge: {
      cobranca_ref: string;
      checkout_ref?: string;
      referencia_externa?: string;
      provedor_pagamento_ref?: string;
    } | undefined = chargeRows[0] ? {
      cobranca_ref: String(chargeRows[0].cobranca_ref),
      checkout_ref: chargeRows[0].checkout_ref ? String(chargeRows[0].checkout_ref) : undefined,
      referencia_externa: chargeRows[0].referencia_externa
        ? String(chargeRows[0].referencia_externa) : undefined,
      provedor_pagamento_ref: chargeRows[0].provedor_pagamento_ref
        ? String(chargeRows[0].provedor_pagamento_ref) : undefined,
    } : undefined;
    if (!charge) {
      const reference = `charge-link-${randomUUID()}`;
      await connection.execute(
        `INSERT INTO financeiro_cobrancas
           (id, instituicao_id, organizacao_ref, ref_core, sessao_ref, paciente_ref,
            profissional_ref, emitida_em, vence_em, valor_centavos, status,
            descricao, criado_em, atualizado_em)
         VALUES (?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP(3), CURRENT_TIMESTAMP(3),
                 ?, 'pending', 'Pagamento direto de psicoterapia',
                 CURRENT_TIMESTAMP(3), CURRENT_TIMESTAMP(3))`,
        [rowId('cobranca', reference), instituicaoId(), patient.organizacao_ref,
          reference, `payment-link-${reference}`, patient.paciente_ref,
          patient.profissional_ref, Number(patient.valor_centavos)]
      );
      charge = { cobranca_ref: reference };
    }

    const checkoutId = String(charge.checkout_ref || randomUUID());
    const externalReference = String(
      charge.referencia_externa || `VM-${checkoutId.replaceAll('-', '')}`
    );
    if (!charge.checkout_ref) {
      await connection.execute(
        `INSERT INTO financeiro_checkouts_asaas
           (id, instituicao_id, organizacao_ref, cobranca_ref, modalidade, referencia_externa)
         VALUES (?, ?, ?, ?, ?, ?)`,
        [rowId('checkout', checkoutId), instituicaoId(), patient.organizacao_ref,
          charge.cobranca_ref, input.modality, externalReference]
      );
    }
    await connection.commit();
    return {
      id: checkoutId,
      externalReference,
      chargeId: String(charge.cobranca_ref),
      patientId: String(patient.paciente_ref),
      patientName: String(patient.nome_paciente),
      patientCpf: String(patient.cpf).replace(/\D/g, ''),
      patientPhone: patient.telefone ? String(patient.telefone) : undefined,
      patientEmail: patient.email ? String(patient.email) : undefined,
      amountCents: Number(patient.valor_centavos),
      professionalName: String(patient.profissional_nome),
      providerPaymentId: charge.provedor_pagamento_ref
        ? String(charge.provedor_pagamento_ref)
        : undefined,
    };
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
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
