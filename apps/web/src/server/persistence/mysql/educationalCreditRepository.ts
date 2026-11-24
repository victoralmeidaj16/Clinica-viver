import 'server-only';
import type { Pool, RowDataPacket } from 'mysql2/promise';
import type { EducationalCreditLine, FinancialFilter } from '@thats-life/core';
import { getMysqlPool } from '@/server/oci/runtime';
import { fromSqlTimestamp, instituicaoId, toSqlTimestamp } from './mappers';

export async function lerCreditos(organizationId: string, filter: FinancialFilter, pool: Pick<Pool, 'query'> = getMysqlPool()): Promise<EducationalCreditLine[]> {
  const predicates = ['instituicao_id = ?', 'organizacao_ref = ?'];
  const params: unknown[] = [instituicaoId(), organizationId];
  if (filter.professionalIds?.length) {
    predicates.push('profissional_ref IN (?)');
    params.push([...filter.professionalIds]);
  }
  if (filter.patientIds?.length) {
    predicates.push('paciente_ref IN (?)');
    params.push([...filter.patientIds]);
  }
  if (filter.startDate) {
    predicates.push('competencia_em >= ?');
    params.push(toSqlTimestamp(filter.startDate));
  }
  if (filter.endDate) {
    predicates.push('competencia_em <= ?');
    params.push(toSqlTimestamp(filter.endDate));
  }
  const [rows] = await pool.query<RowDataPacket[]>(
    `SELECT id, origem, cobranca_ref, sessao_ref, paciente_ref, profissional_ref,
            competencia_em, base_centavos, credito_centavos, forma, original_id, justificativa, evento_ref, autor_ref,
            (SELECT COALESCE(p.provedor_transacao_ref,p.ref_core) FROM financeiro_pagamentos p
              WHERE p.instituicao_id=e.instituicao_id AND p.organizacao_ref=e.organizacao_ref AND p.cobranca_ref=e.cobranca_ref
                AND (e.origem='package' OR (e.origem='payment' AND e.origem_ref=p.ref_core))
              ORDER BY p.recebido_em LIMIT 1) AS comprovante,
            (SELECT p.comprovante_url FROM financeiro_pagamentos p
              WHERE p.instituicao_id=e.instituicao_id AND p.organizacao_ref=e.organizacao_ref AND p.cobranca_ref=e.cobranca_ref
                AND (e.origem='package' OR (e.origem='payment' AND e.origem_ref=p.ref_core))
              ORDER BY p.recebido_em LIMIT 1) AS comprovante_url,
            (SELECT JSON_ARRAYAGG(r.evento) FROM financeiro_eventos_revisao_credito r
              WHERE r.instituicao_id=e.instituicao_id AND r.organizacao_ref=e.organizacao_ref AND r.cobranca_ref=e.cobranca_ref
                AND (e.origem<>'payment' OR e.origem_ref=r.pagamento_ref)) AS estornos
       FROM financeiro_creditos_educacionais e WHERE ${predicates.join(' AND ')}
      ORDER BY competencia_em DESC, id`, params);
  return rows.map(row => ({
    id: row.id, source: row.origem, chargeId: row.cobranca_ref, sessionId: row.sessao_ref,
    patientId: row.paciente_ref, professionalId: row.profissional_ref, occurredAt: fromSqlTimestamp(row.competencia_em)!,
    authorId:row.autor_ref ?? undefined, receiptRef:row.comprovante ?? undefined, receiptUrl:row.comprovante_url ?? undefined,
    refundRefs: typeof row.estornos === 'string' ? JSON.parse(row.estornos) : row.estornos ?? [],
    originalId: row.original_id ?? undefined, justification: row.justificativa ?? undefined, eventRef: row.evento_ref ?? undefined,
    baseCents: Number(row.base_centavos), creditCents: Number(row.credito_centavos), paymentMethod: row.forma ?? undefined,
  }));
}
