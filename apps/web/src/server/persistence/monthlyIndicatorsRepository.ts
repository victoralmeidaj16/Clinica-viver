import 'server-only';

import type { RowDataPacket } from 'mysql2';
import { readSnapshot } from '@/server/application/persistence';
import { getMysqlPool, isMysqlConfigured } from '@/server/oci/runtime';
import { fromSqlTimestamp, instituicaoId, toSqlTimestamp } from './mysql/mappers';

export interface MonthlyLeadFact {
  idade?: string;
  genero?: string;
  origem?: string;
  modalidade?: string;
  alocadoEm?: string;
  confirmadoEm?: string;
  slaExpirado: boolean;
}

export interface StatusCount {
  status: string;
  quantidade: number;
}

export interface MonthlyIndicatorsData {
  queue: {
    pendentesAtribuicao: number;
    aguardandoContato: number;
    alocados: number;
    semProfissional: number;
  };
  leads: MonthlyLeadFact[];
  sessions: StatusCount[];
  previousSessions: StatusCount[];
  audit: StatusCount[];
  firstAuditAt: string | null;
}

export interface MonthlyIndicatorsQuery {
  organizationId: string;
  start: string;
  end: string;
  previousStart: string;
}

interface QueueRow extends RowDataPacket {
  pendentes_atribuicao: number;
  aguardando_contato: number;
  alocados: number;
  sem_profissional: number;
}

interface LeadRow extends RowDataPacket {
  idade: string | null;
  genero: string | null;
  origem: string | null;
  modalidade: string | null;
  alocado_em: string | null;
  confirmado_em: string | null;
  sla_expirado: number;
}

interface CountRow extends RowDataPacket {
  status: string;
  quantidade: number;
}

interface AuditFirstRow extends RowDataPacket {
  primeiro_evento_em: string | null;
}

function number(value: unknown): number {
  return Number(value ?? 0);
}

async function readMysql(query: MonthlyIndicatorsQuery): Promise<MonthlyIndicatorsData> {
  const pool = getMysqlPool();
  const tenant = [instituicaoId(), query.organizationId];
  const start = toSqlTimestamp(query.start);
  const end = toSqlTimestamp(query.end);
  const previousStart = toSqlTimestamp(query.previousStart);

  const [queueResult, leadsResult, sessionsResult, previousResult, auditResult, firstAuditResult] =
    await Promise.all([
      pool.query<QueueRow[]>(
        `SELECT
           SUM(status = 'PENDENTE_ATRIBUICAO') AS pendentes_atribuicao,
           SUM(status = 'AGUARDANDO_CONTATO') AS aguardando_contato,
           SUM(status IN ('PENDENTE_ATRIBUICAO','AGUARDANDO_CONTATO') AND psicologo_alocado_id IS NOT NULL) AS alocados,
           SUM(status IN ('PENDENTE_ATRIBUICAO','AGUARDANDO_CONTATO') AND psicologo_alocado_id IS NULL) AS sem_profissional
         FROM clinica_triagens_pacientes
         WHERE instituicao_id = ? AND organizacao_ref = ?`,
        tenant
      ),
      pool.query<LeadRow[]>(
        `SELECT idade, genero, origem, modalidade, alocado_em, confirmado_em, sla_expirado
         FROM clinica_triagens_pacientes
         WHERE instituicao_id = ? AND organizacao_ref = ?
           AND criado_em >= ? AND criado_em < ?`,
        [...tenant, start, end]
      ),
      pool.query<CountRow[]>(
        `SELECT status, COUNT(*) AS quantidade
         FROM clinica_sessoes
         WHERE instituicao_id = ? AND organizacao_ref = ?
           AND inicio_previsto >= ? AND inicio_previsto < ?
         GROUP BY status`,
        [...tenant, start, end]
      ),
      pool.query<CountRow[]>(
        `SELECT status, COUNT(*) AS quantidade
         FROM clinica_sessoes
         WHERE instituicao_id = ? AND organizacao_ref = ?
           AND inicio_previsto >= ? AND inicio_previsto < ?
         GROUP BY status`,
        [...tenant, previousStart, start]
      ),
      pool.query<CountRow[]>(
        `SELECT acao AS status, COUNT(*) AS quantidade
         FROM clinica_auditoria_acessos
         WHERE instituicao_id = ? AND organizacao_ref = ?
           AND ocorrido_em >= ? AND ocorrido_em < ?
         GROUP BY acao`,
        [...tenant, start, end]
      ),
      pool.query<AuditFirstRow[]>(
        `SELECT MIN(ocorrido_em) AS primeiro_evento_em
         FROM clinica_auditoria_acessos
         WHERE instituicao_id = ? AND organizacao_ref = ?`,
        tenant
      ),
    ]);

  const queue = queueResult[0][0];
  return {
    queue: {
      pendentesAtribuicao: number(queue?.pendentes_atribuicao),
      aguardandoContato: number(queue?.aguardando_contato),
      alocados: number(queue?.alocados),
      semProfissional: number(queue?.sem_profissional),
    },
    leads: leadsResult[0].map((row) => ({
      idade: row.idade ?? undefined,
      genero: row.genero ?? undefined,
      origem: row.origem ?? undefined,
      modalidade: row.modalidade ?? undefined,
      alocadoEm: fromSqlTimestamp(row.alocado_em),
      confirmadoEm: fromSqlTimestamp(row.confirmado_em),
      slaExpirado: Boolean(row.sla_expirado),
    })),
    sessions: sessionsResult[0].map((row) => ({ status: row.status, quantidade: number(row.quantidade) })),
    previousSessions: previousResult[0].map((row) => ({ status: row.status, quantidade: number(row.quantidade) })),
    audit: auditResult[0].map((row) => ({ status: row.status, quantidade: number(row.quantidade) })),
    firstAuditAt: fromSqlTimestamp(firstAuditResult[0][0]?.primeiro_evento_em ?? null) ?? null,
  };
}

function inRange(value: string, start: string, end: string): boolean {
  const timestamp = Date.parse(value);
  return timestamp >= Date.parse(start) && timestamp < Date.parse(end);
}

function counts(statuses: readonly string[]): StatusCount[] {
  const result = new Map<string, number>();
  statuses.forEach((status) => result.set(status, (result.get(status) ?? 0) + 1));
  return [...result].map(([status, quantidade]) => ({ status, quantidade }));
}

function readMemory(query: MonthlyIndicatorsQuery): MonthlyIndicatorsData {
  const snapshot = readSnapshot();
  const allLeads = snapshot?.triagensPacientes ?? [];
  const queueLeads = allLeads.filter((lead) =>
    ['PENDENTE_ATRIBUICAO', 'AGUARDANDO_CONTATO'].includes(lead.status)
  );
  const sessions = snapshot?.sessions.filter((item) => item.organizationId === query.organizationId) ?? [];
  return {
    queue: {
      pendentesAtribuicao: queueLeads.filter((lead) => lead.status === 'PENDENTE_ATRIBUICAO').length,
      aguardandoContato: queueLeads.filter((lead) => lead.status === 'AGUARDANDO_CONTATO').length,
      alocados: queueLeads.filter((lead) => Boolean(lead.psicologoAlocadoId)).length,
      semProfissional: queueLeads.filter((lead) => !lead.psicologoAlocadoId).length,
    },
    leads: allLeads.filter((lead) => inRange(lead.criadoEm, query.start, query.end)).map((lead) => ({
      idade: lead.idade,
      genero: lead.genero,
      origem: lead.origem,
      modalidade: lead.modalidade,
      alocadoEm: lead.alocadoEm,
      confirmadoEm: lead.confirmadoEm,
      slaExpirado: Boolean(lead.slaExpirado),
    })),
    sessions: counts(sessions.filter((item) => inRange(item.scheduledStart, query.start, query.end)).map((item) => item.status)),
    previousSessions: counts(sessions.filter((item) => inRange(item.scheduledStart, query.previousStart, query.start)).map((item) => item.status)),
    audit: [],
    firstAuditAt: null,
  };
}

export async function readMonthlyIndicatorsData(query: MonthlyIndicatorsQuery): Promise<MonthlyIndicatorsData> {
  return isMysqlConfigured() ? readMysql(query) : readMemory(query);
}
