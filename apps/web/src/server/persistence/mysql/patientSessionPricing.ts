import 'server-only';

import type { PoolConnection, ResultSetHeader, RowDataPacket } from 'mysql2/promise';
import { ApplicationError } from '@/server/application/http';
import { getMysqlPool } from '@/server/oci/runtime';
import { instituicaoId } from './mappers';

export const patientSessionPricingCategories = ['acessivel', 'particular', 'personalizado'] as const;
export type PatientSessionPricingCategory = (typeof patientSessionPricingCategories)[number];

export interface PatientSessionPricing {
  category: PatientSessionPricingCategory | null;
  customAmountCents: number | null;
}

export function resolvePatientSessionAmountCents(input: {
  pricing: PatientSessionPricing;
  triageMode?: unknown;
  socialAmountCents: unknown;
  standardAmountCents: unknown;
}): number {
  const social = Number(input.socialAmountCents);
  const standard = Number(input.standardAmountCents);
  const fallback = String(input.triageMode ?? '').toLocaleUpperCase('pt-BR').includes('SOCIAL')
    ? social
    : standard;
  const resolved = input.pricing.category === 'personalizado' && input.pricing.customAmountCents
    ? input.pricing.customAmountCents
    : input.pricing.category === 'acessivel'
      ? social
      : input.pricing.category === 'particular'
        ? standard
        : fallback;
  if (!Number.isSafeInteger(resolved) || resolved <= 0) {
    throw new Error('O valor da sessão não está configurado para este atendimento.');
  }
  return resolved;
}

function category(value: unknown): PatientSessionPricingCategory | null {
  if (value === null || value === undefined || value === '') return null;
  return patientSessionPricingCategories.includes(value as PatientSessionPricingCategory)
    ? value as PatientSessionPricingCategory
    : null;
}

export function validatePatientSessionPricing(input: Record<string, unknown>): PatientSessionPricing {
  const selected = category(input.category);
  if (!selected) {
    throw new ApplicationError('INVALID_INPUT', 'Selecione uma categoria de atendimento válida.', 400);
  }
  if (selected !== 'personalizado') return { category: selected, customAmountCents: null };

  const amount = Number(input.customAmountCents);
  if (!Number.isSafeInteger(amount) || amount <= 0) {
    throw new ApplicationError('INVALID_INPUT', 'Informe um valor personalizado válido para a sessão.', 400);
  }
  return { category: selected, customAmountCents: amount };
}

export function patientSessionPricingFromRow(row: { categoria_valor_sessao?: unknown; valor_sessao_personalizado_centavos?: unknown }): PatientSessionPricing {
  const selected = category(row.categoria_valor_sessao);
  const amount = Number(row.valor_sessao_personalizado_centavos);
  return selected === 'personalizado' && Number.isSafeInteger(amount) && amount > 0
    ? { category: selected, customAmountCents: amount }
    : selected ? { category: selected, customAmountCents: null }
      : { category: null, customAmountCents: null };
}

export async function freezeAppointmentSessionAmount(connection: PoolConnection, appointmentId: string): Promise<void> {
  const [rows] = await connection.query<RowDataPacket[]>(
    `SELECT pa.categoria_valor_sessao, pa.valor_sessao_personalizado_centavos,
            p.valor_social_centavos, p.valor_sessao_centavos,
            (SELECT t.modalidade FROM clinica_triagens_pacientes t
              WHERE t.instituicao_id = a.instituicao_id AND t.organizacao_ref = o.ref_core
                AND t.paciente_ref = pa.ref_core ORDER BY t.atualizado_em DESC LIMIT 1) AS modalidade_triagem
       FROM clinica_agendamentos a
       JOIN clinica_organizacoes o ON o.id = a.organizacao_id
       JOIN clinica_pacientes pa ON pa.id = a.paciente_id
       JOIN clinica_profissionais p ON p.id = a.profissional_id
      WHERE a.instituicao_id = ? AND a.id = ? AND a.valor_centavos IS NULL FOR UPDATE`,
    [instituicaoId(), appointmentId]
  );
  const row = rows[0];
  if (!row) return;
  let amount: number;
  try {
    amount = resolvePatientSessionAmountCents({
      pricing: patientSessionPricingFromRow({ categoria_valor_sessao: row.categoria_valor_sessao,
        valor_sessao_personalizado_centavos: row.valor_sessao_personalizado_centavos }), triageMode: row.modalidade_triagem,
      socialAmountCents: row.valor_social_centavos, standardAmountCents: row.valor_sessao_centavos,
    });
  } catch {
    // Sem preço configurado, a agenda continua válida e a cobrança sinaliza a pendência.
    return;
  }
  await connection.execute(
    'UPDATE clinica_agendamentos SET valor_centavos = ? WHERE instituicao_id = ? AND id = ? AND valor_centavos IS NULL',
    [amount, instituicaoId(), appointmentId]
  );
}

export async function updatePatientSessionPricing(
  organizationId: string,
  patientRef: string,
  pricing: PatientSessionPricing,
): Promise<void> {
  const [result] = await getMysqlPool().execute<ResultSetHeader>(
    `UPDATE clinica_pacientes p
       JOIN clinica_organizacoes o ON o.id = p.organizacao_id
        SET p.categoria_valor_sessao = ?,
            p.valor_sessao_personalizado_centavos = ?
      WHERE p.instituicao_id = ? AND o.ref_core = ? AND p.ref_core = ?`,
    [pricing.category, pricing.customAmountCents, instituicaoId(), organizationId, patientRef],
  );
  if (result.affectedRows === 0) {
    throw new ApplicationError('NOT_FOUND', 'Paciente não encontrado.', 404);
  }
}
