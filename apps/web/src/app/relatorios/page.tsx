'use client';

import { useEffect, useMemo, useState } from 'react';
import {
  AlertCircle, Award, BarChart3, Briefcase, Calendar, Clock, DollarSign,
  Download, FileQuestion, PieChart, ShieldCheck, TrendingUp, Users,
} from 'lucide-react';
import { DistributionBars, MonthlyIndicatorCard } from '@/components/reports/MonthlyIndicatorCard';
import { competenciaAtual, type DistributionItem, type MonthlyIndicators } from '@/lib/monthlyIndicators';
import { openMonthlyIndicatorsReport } from '@/lib/monthlyIndicatorsExport';

interface ApiResponse {
  ok: boolean;
  data?: MonthlyIndicators;
  error?: { code: string; message: string };
  meta?: { generatedAt: string; persistence: 'mysql' | 'memory' };
}

function populatedSummary(items: DistributionItem[]): string {
  const populated = items.filter((item) => item.quantidade > 0);
  if (populated.length === 0) return 'Sem dados';
  return populated.slice(0, 2).map((item) => `${item.label} ${item.percentual}%`).join(' · ');
}

function formatCompetencia(value: string): string {
  if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(value)) return 'competência selecionada';
  const [year, month] = value.split('-').map(Number);
  return new Intl.DateTimeFormat('pt-BR', { month: 'long', year: 'numeric', timeZone: 'UTC' })
    .format(new Date(Date.UTC(year, month - 1, 1)));
}

function variationLabel(value: number | null): string {
  if (value === null) return 'Sem base comparável no mês anterior';
  return `${value > 0 ? '+' : ''}${value}% em relação ao mês anterior`;
}

export default function MonthlyIndicatorsPage() {
  const [competencia, setCompetencia] = useState(() => competenciaAtual());
  const [report, setReport] = useState<MonthlyIndicators | null>(null);
  const [generatedAt, setGeneratedAt] = useState<string | null>(null);
  const [persistence, setPersistence] = useState<'mysql' | 'memory' | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const controller = new AbortController();
    fetch(`/api/application/indicadores?competencia=${encodeURIComponent(competencia)}`, {
      signal: controller.signal,
      headers: { Accept: 'application/json' },
    })
      .then(async (response) => {
        const envelope = await response.json() as ApiResponse;
        if (!response.ok || !envelope.ok || !envelope.data) {
          throw new Error(envelope.error?.message ?? 'Não foi possível carregar os indicadores.');
        }
        setReport(envelope.data);
        setGeneratedAt(envelope.meta?.generatedAt ?? new Date().toISOString());
        setPersistence(envelope.meta?.persistence ?? null);
      })
      .catch((cause: unknown) => {
        if (cause instanceof DOMException && cause.name === 'AbortError') return;
        setReport(null);
        setError(cause instanceof Error ? cause.message : 'Não foi possível carregar os indicadores.');
      })
      .finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => controller.abort();
  }, [competencia]);

  const auditStart = useMemo(() => {
    if (!report?.auditoria.primeiroEventoEm) return 'Nenhum evento disponível';
    return new Date(report.auditoria.primeiroEventoEm).toLocaleString('pt-BR', { timeZone: report.periodo.timezone });
  }, [report]);

  return (
    <main className="mx-auto max-w-6xl space-y-6 pb-12">
      <header className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
        <div>
          <span className="chip-accent mb-1 text-[11px]">Relatório gerencial por competência</span>
          <h1 className="flex items-center gap-2 text-2xl font-black text-ink">
            <BarChart3 className="h-6 w-6 text-psi-vibrant" /> Indicadores mensais da clínica
          </h1>
          <p className="mt-1 text-xs text-muted">Leads, SLA, sessões e auditoria calculados a partir das fontes oficiais.</p>
        </div>
        <div className="flex flex-wrap items-end gap-2">
          <label className="text-[10px] font-black uppercase tracking-wider text-muted">
            Competência
            <input
              type="month"
              value={competencia}
              onChange={(event) => {
                setLoading(true);
                setError(null);
                setReport(null);
                setCompetencia(event.target.value);
              }}
              className="mt-1 block rounded-xl border border-line bg-surface px-3 py-2 text-xs font-bold text-ink outline-none focus:border-psi-vibrant"
            />
          </label>
          {/*
            Atalho para o relatório de estágio. Ele mora aqui, e não no menu
            lateral, porque é o mesmo gesto de "prestar contas do mês" que traz
            a gestão a esta tela — e porque foi daqui que ele sumiu, levado sem
            querer pela reescrita da página de indicadores.
          */}
          <a
            href="/relatorios/declaracao"
            className="flex items-center gap-2 rounded-xl border border-psi-vibrant/30 bg-surface px-4 py-2.5 text-xs font-bold text-psi-deep shadow-sm transition-all hover:bg-slate-50"
          >
            <Award className="h-4 w-4 text-psi-vibrant" />
            Relatório de estágio
          </a>

          <button
            type="button"
            disabled={!report || !generatedAt || loading}
            onClick={() => report && generatedAt && openMonthlyIndicatorsReport(report, generatedAt)}
            className="flex items-center gap-2 rounded-xl bg-psi-vibrant px-4 py-2.5 text-xs font-extrabold text-white shadow-lg shadow-psi-vibrant/20 disabled:cursor-not-allowed disabled:opacity-50"
          >
            <Download className="h-4 w-4" /> Exportar relatório
          </button>
        </div>
      </header>

      {loading && (
        <div className="rounded-3xl border border-line bg-surface p-10 text-center text-sm font-semibold text-muted" role="status">
          Calculando indicadores de {formatCompetencia(competencia)}…
        </div>
      )}

      {!loading && error && (
        <div className="flex items-start gap-3 rounded-3xl border border-red-200 bg-red-50 p-5 text-red-800" role="alert">
          <AlertCircle className="mt-0.5 h-5 w-5 shrink-0" />
          <div><p className="font-bold">Não foi possível gerar o relatório.</p><p className="mt-1 text-xs">{error}</p></div>
        </div>
      )}

      {!loading && report && (
        <>
          <div className="flex flex-wrap items-center justify-between gap-2 rounded-2xl border border-line bg-surface px-4 py-3 text-[11px] text-muted">
            <span><strong className="text-ink">{formatCompetencia(report.competencia)}</strong> · fuso {report.periodo.timezone}</span>
            <span>Atualizado em {generatedAt ? new Date(generatedAt).toLocaleString('pt-BR', { timeZone: report.periodo.timezone }) : '—'} · fonte {persistence ?? '—'}</span>
          </div>

          <section className="grid grid-cols-1 gap-5 md:grid-cols-2 lg:grid-cols-3">
            <MonthlyIndicatorCard number={1} title="Fila atual de leads" icon={Users}
              value={`${report.filaAtual.total} aguardando`}
              detail={`${report.filaAtual.alocados} alocados · ${report.filaAtual.semProfissional} sem profissional`}
              info="Fotografia do momento da consulta: reúne leads pendentes de atribuição ou aguardando contato.">
              <p className="mt-3 text-[10px] text-muted">Fotografia atual: {report.filaAtual.pendentesAtribuicao} pendentes de atribuição e {report.filaAtual.aguardandoContato} aguardando contato.</p>
            </MonthlyIndicatorCard>

            <MonthlyIndicatorCard number={2} title="SLA de 24 horas" icon={Clock}
              value={report.sla24h.percentual === null ? 'Sem casos avaliáveis' : `${report.sla24h.percentual}% cumprido`}
              detail={`${report.sla24h.cumpridos} cumpridos · ${report.sla24h.violados} violações`}
              info="Mede o tempo entre a alocação e a confirmação do lead. O percentual considera apenas casos concluídos ou violados.">
              <p className="mt-3 text-[10px] text-muted">{report.sla24h.emAndamento} dentro do prazo · {report.sla24h.semAlocacao} sem alocação · amostra avaliada: {report.sla24h.avaliados}</p>
            </MonthlyIndicatorCard>

            <MonthlyIndicatorCard number={3} title="Gênero dos novos leads" icon={PieChart}
              value={populatedSummary(report.leadsDoMes.genero)} detail={`Amostra: ${report.leadsDoMes.total} leads`}
              info="Distribuição dos leads criados na competência, incluindo a opção Não informado.">
              <DistributionBars items={report.leadsDoMes.genero} />
            </MonthlyIndicatorCard>

            <MonthlyIndicatorCard number={4} title="Faixa etária dos novos leads" icon={Users}
              value={populatedSummary(report.leadsDoMes.faixaEtaria)} detail={`Amostra: ${report.leadsDoMes.total} leads`}
              info="Idades válidas são agrupadas nas faixas 0–17, 18–28, 29–42 e 43+. Idades ausentes ou inválidas ficam separadas.">
              <DistributionBars items={report.leadsDoMes.faixaEtaria} />
            </MonthlyIndicatorCard>

            <MonthlyIndicatorCard number={5} title="Origem dos novos leads" icon={TrendingUp}
              value={populatedSummary(report.leadsDoMes.origens)} detail={`Amostra: ${report.leadsDoMes.total} leads`}
              info="Mostra a origem informada pelos leads criados na competência; diferenças apenas de caixa ou espaços são unificadas.">
              <DistributionBars items={report.leadsDoMes.origens} />
            </MonthlyIndicatorCard>

            <MonthlyIndicatorCard number={6} title="Número de sessões / atendimentos" icon={Calendar}
              value={`${report.sessoes.total} sessões registradas`}
              detail={`${report.sessoes.realizadas} atendimentos realizados · ${variationLabel(report.sessoes.variacaoRealizadasPercentual)}`}
              info="Total de sessões registradas na agenda da competência, em qualquer status. Atendimentos realizados são exclusivamente os concluídos.">
              <p className="mt-3 text-[10px] text-muted">{report.sessoes.agendadas} agendadas · {report.sessoes.confirmadas} confirmadas · {report.sessoes.emAndamento} em andamento · {report.sessoes.canceladas} canceladas · {report.sessoes.faltas} faltas</p>
            </MonthlyIndicatorCard>

            <MonthlyIndicatorCard number={7} title="Modalidades dos novos leads" icon={BarChart3}
              value={populatedSummary(report.leadsDoMes.modalidades)} detail={`Amostra: ${report.leadsDoMes.total} leads`}
              info="Distribuição da modalidade informada pelos leads criados na competência, com valores vazios em Não informado.">
              <DistributionBars items={report.leadsDoMes.modalidades} />
            </MonthlyIndicatorCard>

            {report.indisponiveis.map((item, index) => {
              const icons = [DollarSign, TrendingUp, Briefcase];
              return <MonthlyIndicatorCard key={item.indicador} number={index + 8} title={item.titulo}
                icon={icons[index] ?? FileQuestion} value="Dados ainda não configurados" detail={item.motivo}
                info="Este indicador ainda não tem uma fonte de dados oficial conectada ao relatório." unavailable />;
            })}

            <MonthlyIndicatorCard number={11} title="Eventos reais de auditoria" icon={ShieldCheck} wide
              value={`${report.auditoria.total} eventos`}
              detail={`${report.auditoria.acessosConcedidos} concedidos · ${report.auditoria.acessosNegados} negados`}
              info="Eventos registrados na auditoria de acessos da clínica dentro da competência. O histórico anterior à correção pode estar incompleto.">
              <DistributionBars items={report.auditoria.porAcao} />
              <p className="mt-4 rounded-xl bg-amber-50 px-3 py-2 text-[10px] font-medium text-amber-900">
                O histórico anterior à correção pode estar incompleto. Primeiro evento disponível: {auditStart}.
              </p>
            </MonthlyIndicatorCard>
          </section>
        </>
      )}
    </main>
  );
}
