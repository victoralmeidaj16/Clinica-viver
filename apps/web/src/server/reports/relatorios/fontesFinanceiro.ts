import 'server-only';

import type { RowDataPacket } from 'mysql2';
import { listEducationalCreditLines } from '@thats-life/core';
import { contemTermo, type FiltrosAplicados, type LinhaRelatorio } from '@/lib/relatorios/areas';
import { getMysqlPool, isMysqlConfigured } from '@/server/oci/runtime';
import { fromSqlTimestamp, instituicaoId } from '@/server/persistence/mysql/mappers';
import { listarConvenios } from '@/server/persistence/mysql/convenioRepository';
import { getApplicationStore } from '@/server/application/store';
import { origensCredito } from '@/server/reports/educationalCreditReport';
import { intervaloSql } from './fontesAgenda';

/** Cobranças, convênios e Créditos Educacionais, das mesmas tabelas do Financeiro. */

const SITUACAO_COBRANCA: Record<string, string> = {
  draft: 'Rascunho', pending: 'Em aberto', partially_paid: 'Paga em parte', paid: 'Paga',
  overdue: 'Vencida', cancelled: 'Cancelada', refunded: 'Estornada',
};

export async function relatorioFinanceiro(organizationId: string, filtros: FiltrosAplicados): Promise<LinhaRelatorio[]> {
  if (!isMysqlConfigured()) return [];
  const { desde, ate } = intervaloSql(filtros);
  const valores: unknown[] = [instituicaoId(), organizationId];
  let sql = `SELECT c.ref_core, c.vence_em, c.valor_centavos, c.status, c.convenio_ref, c.fatura_convenio_ref,
                    COALESCE(pa.nome_social, pa.nome, c.paciente_ref) AS paciente, COALESCE(p.nome, c.profissional_ref) AS profissional,
                    conv.nome AS convenio,
                    (SELECT COALESCE(SUM(pg.valor_centavos), 0) FROM financeiro_pagamentos pg
                      WHERE pg.instituicao_id = c.instituicao_id AND pg.organizacao_ref = c.organizacao_ref
                        AND pg.cobranca_ref = c.ref_core AND pg.status = 'confirmed') AS recebido
               FROM financeiro_cobrancas c
               LEFT JOIN clinica_pacientes pa ON pa.instituicao_id = c.instituicao_id AND pa.ref_core = c.paciente_ref
               LEFT JOIN clinica_profissionais p ON p.instituicao_id = c.instituicao_id AND p.ref_core = c.profissional_ref
               LEFT JOIN clinica_convenios conv ON conv.instituicao_id = c.instituicao_id AND conv.organizacao_ref = c.organizacao_ref
                AND conv.ref_core = c.convenio_ref
              WHERE c.instituicao_id = ? AND c.organizacao_ref = ?`;
  if (desde) { sql += ' AND c.vence_em >= ?'; valores.push(desde); }
  if (ate) { sql += ' AND c.vence_em <= ?'; valores.push(ate); }
  const [rows] = await getMysqlPool().query<RowDataPacket[]>(`${sql} ORDER BY c.vence_em DESC LIMIT 5000`, valores);
  return rows
    .filter((r) => contemTermo(r.profissional, filtros.profissional) && contemTermo(r.paciente, filtros.paciente)
      && contemTermo(r.convenio, filtros.empresa))
    .map((r) => ({
      vencimento: fromSqlTimestamp(r.vence_em) ?? null,
      paciente: String(r.paciente),
      profissional: String(r.profissional),
      situacao: SITUACAO_COBRANCA[String(r.status)] ?? String(r.status),
      pagador: r.convenio_ref || r.fatura_convenio_ref ? `Empresa${r.convenio ? ` (${r.convenio})` : ''}` : 'Paciente',
      valor: Number(r.valor_centavos ?? 0) / 100,
      recebido: Number(r.recebido ?? 0) / 100,
      referencia: String(r.ref_core),
    }));
}

export async function relatorioConvenios(organizationId: string, filtros: FiltrosAplicados): Promise<LinhaRelatorio[]> {
  if (!isMysqlConfigured()) return [];
  return (await listarConvenios(organizationId))
    .filter((c) => contemTermo(`${c.nome} ${c.razaoSocial ?? ''} ${c.cnpj ?? ''}`, filtros.empresa))
    .map((c) => ({
      empresa: c.nome,
      cnpj: c.cnpj ?? null,
      ativo: c.ativo ? 'Ativo' : 'Inativo',
      custeio: c.empresaPagaSessoes ? 'Sim' : 'Não',
      cota: c.pacoteSessoes ?? (c.empresaPagaSessoes ? 'Sem limite' : null),
      pacientes: c.pacientes,
      custeados: c.pacientesCusteados,
      sessoes: c.sessoesProvisionadas,
      provisionado: c.valorProvisionadoCents / 100,
    }));
}

export async function relatorioCreditos(organizationId: string, filtros: FiltrosAplicados): Promise<LinhaRelatorio[]> {
  const { desde, ate } = intervaloSql(filtros);
  const filtro = { organizationId, startDate: desde?.toISOString(), endDate: ate?.toISOString() };
  const { financial, identities } = getApplicationStore();
  const creditos = financial.listPersistedCredits
    ? await financial.listPersistedCredits(organizationId, filtro)
    : listEducationalCreditLines(await financial.getLedger({ organizationId }), filtro);
  const nomes = new Map(await Promise.all([...new Set(creditos.map((l) => l.professionalId))].map(async (id) =>
    [id, (await identities.getProfessional(organizationId, id))?.displayName ?? id] as const)));
  return creditos
    .map((l) => ({
      data: l.occurredAt,
      profissional: nomes.get(l.professionalId) ?? l.professionalId,
      origem: origensCredito[l.source as keyof typeof origensCredito] ?? l.source,
      base: l.baseCents / 100,
      credito: l.creditCents / 100,
      referencia: l.receiptRef ?? l.chargeId,
      justificativa: l.justification ?? null,
    }))
    .filter((l) => contemTermo(l.profissional, filtros.profissional));
}
