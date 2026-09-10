'use client';

import { useEffect, useMemo, useState } from 'react';
import { Calendar as CalendarIcon, ChevronLeft, ChevronRight, Clock3, X } from 'lucide-react';
import type { BloqueioAgenda, NovoBloqueioAgenda } from './AgendaBlocks';
import type { JanelaEditavel } from './AvailabilityEditor';
import type { AgendamentoResumo } from './UpcomingSessions';
import { CalendarMonthGrid } from './CalendarMonthGrid';
import { DaySchedulePanel } from './DaySchedulePanel';
import { dataLocal, formatMonthYear, monthCells } from './agendaCalendarModel';

interface Props {
  availability: readonly JanelaEditavel[];
  blocks: readonly BloqueioAgenda[];
  appointments: readonly AgendamentoResumo[];
  onAdicionarBloqueio: (input: NovoBloqueioAgenda) => Promise<void>;
  onRemoverBloqueio: (id: string) => Promise<void>;
}

export function ProfessionalCalendarView({
  availability,
  blocks,
  appointments,
  onAdicionarBloqueio,
  onRemoverBloqueio,
}: Props) {
  const [hoje, setHoje] = useState(() => dataLocal(Date.now()));
  const [ano, setAno] = useState(() => Number(hoje.slice(0, 4)));
  const [mes, setMes] = useState(() => Number(hoje.slice(5, 7)) - 1);
  const [selecionados, setSelecionados] = useState<string[]>(() => [hoje]);

  useEffect(() => {
    const dataAtual = dataLocal(Date.now());
    setHoje(dataAtual);
    setAno(Number(dataAtual.slice(0, 4)));
    setMes(Number(dataAtual.slice(5, 7)) - 1);
    setSelecionados((atual) => (atual.length === 0 ? [dataAtual] : atual));
  }, []);

  const celulas = useMemo(() => monthCells(ano, mes), [ano, mes]);
  const diasDisponiveis = useMemo(
    () => new Set(availability.map((janela) => janela.diaSemana)),
    [availability]
  );

  const navegarMes = (direcao: -1 | 1) => {
    const data = new Date(Date.UTC(ano, mes + direcao, 1));
    setAno(data.getUTCFullYear());
    setMes(data.getUTCMonth());
  };

  const selecionar = (data: string) => {
    setSelecionados((atual) =>
      atual.includes(data) ? atual.filter((item) => item !== data) : [...atual, data]
    );
  };

  const selecionarDiasUteis = () => {
    const uteis = celulas.filter((data): data is string => {
      if (!data) return false;
      const dia = new Date(`${data}T12:00:00Z`).getUTCDay();
      return dia >= 1 && dia <= 5;
    });
    setSelecionados((atual) => Array.from(new Set([...atual, ...uteis])));
  };

  const abrirHoje = () => {
    const dataAtual = dataLocal(Date.now());
    setHoje(dataAtual);
    setAno(Number(dataAtual.slice(0, 4)));
    setMes(Number(dataAtual.slice(5, 7)) - 1);
    setSelecionados((atual) => (atual.includes(dataAtual) ? atual : [...atual, dataAtual]));
  };

  return (
    <section className="overflow-hidden rounded-3xl border border-line bg-surface shadow-card">
      <header className="flex flex-wrap items-center justify-between gap-4 bg-psi-darkest p-5 text-white sm:p-6">
        <div>
          <p className="text-[10px] font-black uppercase tracking-[.2em] text-psi-vibrant">Agenda sem conflitos</p>
          <h2 className="mt-1 flex items-center gap-2 text-lg font-extrabold">
            <CalendarIcon className="h-5 w-5 text-psi-vibrant" /> Calendário do profissional
          </h2>
          <p className="mt-1 text-xs text-psi-soft/75">
            Selecione uma ou mais datas para bloquear horários pontuais sem alterar sua rotina semanal.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {selecionados.length > 0 && (
            <div className="flex items-center gap-2">
              <span className="rounded-xl border border-white/20 bg-white/10 px-3 py-2 text-xs font-extrabold text-white">
                {selecionados.length} {selecionados.length === 1 ? 'dia ativo' : 'dias ativos'}
              </span>
              <button
                type="button"
                onClick={() => setSelecionados([])}
                className="flex items-center gap-1.5 rounded-xl border border-rose-400/30 bg-rose-500/20 px-3 py-2 text-xs font-bold text-rose-200 transition hover:bg-rose-500/30"
              >
                <X className="h-3.5 w-3.5" /> Limpar seleção
              </button>
            </div>
          )}

          <button
            type="button"
            onClick={abrirHoje}
            className="flex items-center gap-1.5 rounded-xl bg-psi-vibrant px-3.5 py-2.5 text-xs font-extrabold text-white transition hover:bg-psi-vibrant/90"
          >
            <Clock3 className="h-4 w-4" /> Hoje
          </button>
        </div>
      </header>

      <div className="grid divide-y divide-line lg:grid-cols-12 lg:divide-x lg:divide-y-0">
        {/* COLUNA DA ESQUERDA: GRADE DO CALENDÁRIO */}
        <div className="space-y-4 p-4 sm:p-6 lg:col-span-7">
          <div className="flex items-center justify-between">
            <button
              type="button"
              onClick={() => navegarMes(-1)}
              aria-label="Mês anterior"
              className="rounded-xl border border-slate-200 p-2 transition hover:bg-slate-100"
            >
              <ChevronLeft className="h-4 w-4" />
            </button>
            <h3 className="text-sm font-black capitalize text-ink">{formatMonthYear(ano, mes)}</h3>
            <button
              type="button"
              onClick={() => navegarMes(1)}
              aria-label="Próximo mês"
              className="rounded-xl border border-slate-200 p-2 transition hover:bg-slate-100"
            >
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>

          <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-slate-200/80 bg-slate-50/80 p-2.5 text-[11px] font-bold text-slate-700">
            <span>Clique nas datas para adicionar ou remover da lista ao lado.</span>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={selecionarDiasUteis}
                className="text-psi-deep underline hover:text-psi-darkest"
              >
                + Dias úteis do mês
              </button>
              {selecionados.length > 0 && (
                <button
                  type="button"
                  onClick={() => setSelecionados([])}
                  className="text-rose-600 underline hover:text-rose-800"
                >
                  Limpar ({selecionados.length})
                </button>
              )}
            </div>
          </div>

          <CalendarMonthGrid
            celulas={celulas}
            diasDisponiveis={diasDisponiveis}
            bloqueios={blocks}
            agendamentos={appointments}
            selecionados={selecionados}
            hoje={hoje}
            onSelecionar={selecionar}
          />
        </div>

        {/* COLUNA DA DIREITA: PAINEL DE HORÁRIOS DOS DIAS SELECIONADOS */}
        <aside className="space-y-5 bg-canvas/40 p-4 sm:p-6 lg:col-span-5">
          <DaySchedulePanel
            datas={selecionados}
            availability={availability}
            bloqueios={blocks}
            agendamentos={appointments}
            onAdicionar={onAdicionarBloqueio}
            onRemover={onRemoverBloqueio}
            onRemoverData={(data) => setSelecionados((atual) => atual.filter((d) => d !== data))}
            onLimparTodasDatas={() => setSelecionados([])}
          />
        </aside>
      </div>
    </section>
  );
}
