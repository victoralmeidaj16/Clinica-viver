import 'server-only';

import { assertStaffAuthorized } from '@thats-life/core';
import {
  REPORT_TIME_ZONE,
  type DistributionItem,
  type MonthlyIndicators,
} from '@/lib/monthlyIndicators';
import { readMonthlyIndicatorsData, type MonthlyLeadFact, type StatusCount } from '@/server/persistence/monthlyIndicatorsRepository';
import type { RequestContext } from './context';
import { ApplicationError } from './http';

const SLA_MS = 24 * 60 * 60 * 1000;

function partsInSaoPaulo(date: Date) {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: REPORT_TIME_ZONE,
    year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', second: '2-digit', hourCycle: 'h23',
  }).formatToParts(date);
  return Object.fromEntries(parts.map((part) => [part.type, part.value]));
}

function zonedMidnight(year: number, monthIndex: number): string {
  const targetWallClock = Date.UTC(year, monthIndex, 1, 0, 0, 0);
  let candidate = targetWallClock;
  for (let attempt = 0; attempt < 2; attempt += 1) {
    const parts = partsInSaoPaulo(new Date(candidate));
    const representedWallClock = Date.UTC(
      Number(parts.year), Number(parts.month) - 1, Number(parts.day),
      Number(parts.hour), Number(parts.minute), Number(parts.second)
    );
    candidate += targetWallClock - representedWallClock;
  }
  return new Date(candidate).toISOString();
}

export function resolveCompetencia(competencia: string | null, now = new Date()) {
  const fallbackParts = partsInSaoPaulo(now);
  const value = competencia ?? `${fallbackParts.year}-${fallbackParts.month}`;
  const match = /^(\d{4})-(0[1-9]|1[0-2])$/.exec(value);
  if (!match || Number(match[1]) < 2000) {
    throw new ApplicationError('INVALID_COMPETENCIA', 'Competência inválida. Use o formato YYYY-MM.', 400);
  }
  const year = Number(match[1]);
  const monthIndex = Number(match[2]) - 1;
  const previousDate = new Date(Date.UTC(year, monthIndex - 1, 1));
  return {
    competencia: value,
    start: zonedMidnight(year, monthIndex),
    end: zonedMidnight(year, monthIndex + 1),
    previousStart: zonedMidnight(previousDate.getUTCFullYear(), previousDate.getUTCMonth()),
  };
}

function roundedDistribution(entries: Array<{ label: string; quantidade: number }>): DistributionItem[] {
  const total = entries.reduce((sum, item) => sum + item.quantidade, 0);
  if (total === 0) return entries.map((item) => ({ ...item, percentual: 0 }));
  const calculated = entries.map((item, index) => {
    const exact = (item.quantidade / total) * 100;
    return { ...item, index, percentual: Math.floor(exact), remainder: exact - Math.floor(exact) };
  });
  let missing = 100 - calculated.reduce((sum, item) => sum + item.percentual, 0);
  [...calculated].sort((a, b) => b.remainder - a.remainder || a.index - b.index)
    .forEach((item) => { if (missing > 0) { calculated[item.index].percentual += 1; missing -= 1; } });
  return calculated.map(({ label, quantidade, percentual }) => ({ label, quantidade, percentual }));
}

function fixedDistribution(values: string[], labels: string[]): DistributionItem[] {
  return roundedDistribution(labels.map((label) => ({
    label,
    quantidade: values.filter((value) => value === label).length,
  })));
}

function normalizeText(value: string | undefined): string {
  const cleaned = value?.trim().replace(/\s+/g, ' ');
  return cleaned || 'Não informado';
}

function dynamicDistribution(values: Array<string | undefined>): DistributionItem[] {
  const grouped = new Map<string, { label: string; quantidade: number }>();
  values.forEach((value) => {
    const label = normalizeText(value);
    const key = label.toLocaleUpperCase('pt-BR');
    const current = grouped.get(key);
    grouped.set(key, { label: current?.label ?? label, quantidade: (current?.quantidade ?? 0) + 1 });
  });
  return roundedDistribution([...grouped.values()].sort((a, b) => a.label.localeCompare(b.label, 'pt-BR')));
}

function gender(value: string | undefined): string {
  const normalized = normalizeText(value).toLocaleUpperCase('pt-BR').normalize('NFD').replace(/[\u0300-\u036f]/g, '');
  if (normalized === 'FEMININO') return 'Feminino';
  if (normalized === 'MASCULINO') return 'Masculino';
  if (normalized === 'NAO BINARIO' || normalized === 'NAO_BINARIO') return 'Não binário';
  if (normalized === 'PREFIRO NAO INFORMAR' || normalized === 'PREFIRO_NAO_INFORMAR') return 'Prefiro não informar';
  if (normalized === 'NAO INFORMADO' || !normalized) return 'Não informado';
  return 'Outro';
}

function ageRange(value: string | undefined): string {
  const cleaned = value?.trim();
  if (!cleaned) return 'Não informada/inválida';
  const age = Number(cleaned);
  if (!Number.isInteger(age) || age < 0 || age > 120) return 'Não informada/inválida';
  if (age <= 17) return '0–17';
  if (age <= 28) return '18–28';
  if (age <= 42) return '29–42';
  return '43+';
}

function calculateSla(leads: MonthlyLeadFact[], now: Date): MonthlyIndicators['sla24h'] {
  let cumpridos = 0; let violados = 0; let emAndamento = 0; let semAlocacao = 0;
  leads.forEach((lead) => {
    const allocated = lead.alocadoEm ? Date.parse(lead.alocadoEm) : Number.NaN;
    if (!Number.isFinite(allocated)) { semAlocacao += 1; return; }
    const confirmed = lead.confirmadoEm ? Date.parse(lead.confirmadoEm) : Number.NaN;
    if (lead.slaExpirado || (Number.isFinite(confirmed) && confirmed - allocated > SLA_MS)) {
      violados += 1;
    } else if (Number.isFinite(confirmed)) {
      cumpridos += 1;
    } else if (now.getTime() >= allocated + SLA_MS) {
      violados += 1;
    } else {
      emAndamento += 1;
    }
  });
  const avaliados = cumpridos + violados;
  return {
    cumpridos, violados, emAndamento, semAlocacao, avaliados,
    percentual: avaliados > 0 ? Number(((cumpridos / avaliados) * 100).toFixed(1)) : null,
  };
}

function count(statuses: StatusCount[], status: string): number {
  return statuses.find((item) => item.status === status)?.quantidade ?? 0;
}

function actionLabel(action: string): string {
  return ({
    'clinical_record.read': 'Leitura de prontuário',
    'clinical_record.listed': 'Listagem de prontuários',
    'clinical_record.access_denied': 'Acesso negado',
    'clinical_timeline.listed': 'Linha do tempo consultada',
    'clinical_timeline.searched': 'Busca na linha do tempo',
  } as Record<string, string>)[action] ?? action;
}

export async function getMonthlyIndicators(
  context: RequestContext,
  requestedCompetencia: string | null,
  now = new Date()
): Promise<MonthlyIndicators> {
  assertStaffAuthorized(context.actor, 'audit.read', { organizationId: context.actor.organizationId });
  const period = resolveCompetencia(requestedCompetencia, now);
  const data = await readMonthlyIndicatorsData({ organizationId: context.actor.organizationId, ...period });
  const sessionTotal = data.sessions.reduce((sum, item) => sum + item.quantidade, 0);
  const realizadas = count(data.sessions, 'completed');
  const realizadasMesAnterior = count(data.previousSessions, 'completed');
  const auditEntries = data.audit.map((item) => ({ label: actionLabel(item.status), quantidade: item.quantidade }));
  const auditTotal = auditEntries.reduce((sum, item) => sum + item.quantidade, 0);

  return {
    competencia: period.competencia,
    periodo: { inicio: period.start, fimExclusivo: period.end, timezone: REPORT_TIME_ZONE },
    filaAtual: { ...data.queue, total: data.queue.pendentesAtribuicao + data.queue.aguardandoContato },
    leadsDoMes: {
      total: data.leads.length,
      genero: fixedDistribution(data.leads.map((lead) => gender(lead.genero)), ['Feminino', 'Masculino', 'Não binário', 'Outro', 'Prefiro não informar', 'Não informado']),
      faixaEtaria: fixedDistribution(data.leads.map((lead) => ageRange(lead.idade)), ['0–17', '18–28', '29–42', '43+', 'Não informada/inválida']),
      origens: dynamicDistribution(data.leads.map((lead) => lead.origem)),
      modalidades: dynamicDistribution(data.leads.map((lead) => lead.modalidade)),
    },
    sla24h: calculateSla(data.leads, now),
    sessoes: {
      realizadas,
      agendadas: count(data.sessions, 'scheduled'),
      confirmadas: count(data.sessions, 'confirmed'),
      emAndamento: count(data.sessions, 'in_progress'),
      canceladas: count(data.sessions, 'cancelled'),
      faltas: count(data.sessions, 'no_show'),
      total: sessionTotal,
      realizadasMesAnterior,
      variacaoRealizadasPercentual: realizadasMesAnterior > 0
        ? Number((((realizadas - realizadasMesAnterior) / realizadasMesAnterior) * 100).toFixed(1))
        : null,
    },
    auditoria: {
      total: auditTotal,
      acessosConcedidos: data.audit.filter((item) => item.status !== 'clinical_record.access_denied').reduce((sum, item) => sum + item.quantidade, 0),
      acessosNegados: count(data.audit, 'clinical_record.access_denied'),
      porAcao: roundedDistribution(auditEntries),
      primeiroEventoEm: data.firstAuditAt,
      historicoPodeEstarIncompleto: true,
    },
    indisponiveis: [
      { indicador: 'ticket_medio', titulo: 'Ticket médio e faixa de valor', motivo: 'Fonte financeira mensal ainda não configurada.' },
      { indicador: 'cac', titulo: 'Custo de aquisição', motivo: 'Investimento mensal de marketing ainda não configurado.' },
      { indicador: 'convenios_pj', titulo: 'Convênios PJ', motivo: 'Cadastro e faturamento por empresa ainda não configurados.' },
    ],
  };
}
