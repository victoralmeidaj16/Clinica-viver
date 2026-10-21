import 'server-only';

import type { ResultSetHeader } from 'mysql2/promise';
import { ApplicationError } from '@/server/application/http';
import { getMysqlPool } from '@/server/oci/runtime';
import { instituicaoId } from './mappers';

export const patientSessionPricingCategories = ['acessivel', 'particular', 'personalizado'] as const;
export type PatientSessionPricingCategory = (typeof patientSessionPricingCategories)[number];

export interface PatientSessionPricing {
  category: PatientSessionPricingCategory | null;
  customAmountCents: number | null;
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
