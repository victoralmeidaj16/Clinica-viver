'use client';

import React, { useState, useMemo } from 'react';
import {
  ChevronLeft,
  ChevronRight,
  Calendar as CalendarIcon,
  CalendarOff,
  CheckSquare,
  User,
} from 'lucide-react';
import type { BloqueioAgenda } from './AgendaBlocks';
import type { JanelaEditavel } from './AvailabilityEditor';
import type { AgendamentoResumo } from './UpcomingSessions';

interface ProfessionalCalendarViewProps {
  availability: readonly JanelaEditavel[];
  blocks: readonly BloqueioAgenda[];
  appointments: readonly AgendamentoResumo[];
  onAdicionarBloqueio: (input: { inicioDia: string; fimDia: string; motivo: string }) => Promise<void>;
  onRemoverBloqueio: (id: string) => Promise<void>;
}

const DIAS_SEMANA = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];

function formatMonthYear(year: number, monthZeroIndexed: number): string {
  return new Date(Date.UTC(year, monthZeroIndexed, 1)).toLocaleDateString('pt-BR', {
    month: 'long',
    year: 'numeric',
    timeZone: 'UTC',
  });
}

export function ProfessionalCalendarView({
  availability,
  blocks,
  appointments,
  onAdicionarBloqueio,
  onRemoverBloqueio,
}: ProfessionalCalendarViewProps) {
  const [currentYear, setCurrentYear] = useState(() => new Date().getFullYear());
  const [currentMonth, setCurrentMonth] = useState(() => new Date().getMonth());

  // Seleção de Dias (Modo Individual ou Lote)
  const [selectedDays, setSelectedDays] = useState<string[]>([]);
  const [isMultiSelectMode, setIsMultiSelectMode] = useState(false);
  const [batchMotivo, setBatchMotivo] = useState('');
  const [executingBatch, setExecutingBatch] = useState(false);
  const [feedbackMessage, setFeedbackMessage] = useState<{ type: 'ok' | 'error'; text: string }>();

  // Navegação de Mês
  const prevMonth = () => {
    if (currentMonth === 0) {
      setCurrentMonth(11);
      setCurrentYear((y) => y - 1);
    } else {
      setCurrentMonth((m) => m - 1);
    }
  };

  const nextMonth = () => {
    if (currentMonth === 11) {
      setCurrentMonth(0);
      setCurrentYear((y) => y + 1);
    } else {
      setCurrentMonth((m) => m + 1);
    }
  };

  // Células do Mês
  const monthCells = useMemo(() => {
    const firstDayIndex = new Date(Date.UTC(currentYear, currentMonth, 1)).getUTCDay();
    const totalDays = new Date(Date.UTC(currentYear, currentMonth + 1, 0)).getUTCDate();

    const empties = Array.from({ length: firstDayIndex }, () => null);
    const days = Array.from({ length: totalDays }, (_, i) => {
      const dayNum = i + 1;
      const mStr = String(currentMonth + 1).padStart(2, '0');
      const dStr = String(dayNum).padStart(2, '0');
      return `${currentYear}-${mStr}-${dStr}`;
    });

    return [...empties, ...days];
  }, [currentYear, currentMonth]);

  // Mapeamento de Disponibilidade da Semana
  const availabilityMap = useMemo(() => {
    const map = new Map<number, JanelaEditavel[]>();
    for (const jan of availability) {
      const list = map.get(jan.diaSemana) || [];
      list.push(jan);
      map.set(jan.diaSemana, list);
    }
    return map;
  }, [availability]);

  // Mapeamento de Bloqueios por Data `YYYY-MM-DD`
  const blockedDatesSet = useMemo(() => {
    const blockedMap = new Map<string, BloqueioAgenda>();

    for (const block of blocks) {
      const start = new Date(block.inicio);
      const end = new Date(Date.parse(block.fim) - 1);

      const curr = new Date(start.getFullYear(), start.getMonth(), start.getDate());
      const last = new Date(end.getFullYear(), end.getMonth(), end.getDate());

      while (curr <= last) {
        const iso = `${curr.getFullYear()}-${String(curr.getMonth() + 1).padStart(2, '0')}-${String(
          curr.getDate()
        ).padStart(2, '0')}`;
        blockedMap.set(iso, block);
        curr.setDate(curr.getDate() + 1);
      }
    }
    return blockedMap;
  }, [blocks]);

  // Mapeamento de Agendamentos por Data `YYYY-MM-DD`
  const appointmentsByDate = useMemo(() => {
    const map = new Map<string, AgendamentoResumo[]>();
    for (const app of appointments) {
      const dateIso = new Date(app.inicio).toLocaleDateString('en-CA', { timeZone: 'America/Sao_Paulo' });
      const list = map.get(dateIso) || [];
      list.push(app);
      map.set(dateIso, list);
    }
    return map;
  }, [appointments]);

  // Handler de Clique no Dia do Calendário
  const handleDayClick = (dateIso: string) => {
    if (isMultiSelectMode) {
      setSelectedDays((prev) =>
        prev.includes(dateIso) ? prev.filter((d) => d !== dateIso) : [...prev, dateIso]
      );
    } else {
      setSelectedDays([dateIso]);
    }
  };

  // Selecionar Dias Úteis do Mês Exibido
  const handleSelectWeekdaysMonth = () => {
    const weekdaysInMonth: string[] = [];
    for (const cell of monthCells) {
      if (!cell) continue;
      const dayOfWeek = new Date(`${cell}T12:00:00Z`).getUTCDay();
      if (dayOfWeek >= 1 && dayOfWeek <= 5) {
        weekdaysInMonth.push(cell);
      }
    }
    setIsMultiSelectMode(true);
    setSelectedDays(weekdaysInMonth);
  };

  // Bloquear Dias Selecionados em Lote
  const handleBloquearDiasSelecionados = async () => {
    if (selectedDays.length === 0) return;
    setExecutingBatch(true);
    setFeedbackMessage(undefined);

    try {
      // Ordena as datas para encontrar intervalos contínuos se houver, ou bloqueia uma por uma
      const sorted = [...selectedDays].sort();
      const first = sorted[0];
      const last = sorted[sorted.length - 1];

      await onAdicionarBloqueio({
        inicioDia: first,
        fimDia: last,
        motivo: batchMotivo.trim() || 'Bloqueio selecionado pelo calendário',
      });

      setFeedbackMessage({
        type: 'ok',
        text: `${selectedDays.length} dia(s) bloqueado(s) com sucesso na sua agenda!`,
      });
      setSelectedDays([]);
      setBatchMotivo('');
    } catch (err: unknown) {
      setFeedbackMessage({
        type: 'error',
        text: err instanceof Error ? err.message : 'Não foi possível bloquear os dias.',
      });
    } finally {
      setExecutingBatch(false);
    }
  };

  const selectedDateSingle = selectedDays.length === 1 ? selectedDays[0] : null;
  const singleDayAppointments = selectedDateSingle ? appointmentsByDate.get(selectedDateSingle) || [] : [];
  const singleDayBlock = selectedDateSingle ? blockedDatesSet.get(selectedDateSingle) : null;
  const singleDayOfWeek = selectedDateSingle ? new Date(`${selectedDateSingle}T12:00:00Z`).getUTCDay() : null;
  const singleDayWindows = singleDayOfWeek !== null ? availabilityMap.get(singleDayOfWeek) || [] : [];

  return (
    <div className="bg-surface rounded-3xl border border-line shadow-card overflow-hidden space-y-0">
      {/* Header do Calendário Interativo */}
      <div className="p-6 bg-gradient-to-r from-slate-900 via-psi-darkest to-slate-900 border-b border-line text-white flex flex-wrap items-center justify-between gap-4">
        <div>
          <span className="text-[10px] font-black uppercase tracking-widest text-psi-vibrant bg-psi-vibrant/20 px-2.5 py-1 rounded-full border border-psi-vibrant/30">
            Visão Geral Interativa
          </span>
          <h3 className="font-extrabold text-lg text-white flex items-center gap-2 mt-1">
            <CalendarIcon className="w-5 h-5 text-psi-vibrant" /> Calendário do Profissional
          </h3>
          <p className="text-xs text-slate-300">
            Clique nos dias para visualizar agendamentos, criar bloqueios de datas ou modificar em lote.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => {
              setIsMultiSelectMode(!isMultiSelectMode);
              setSelectedDays([]);
            }}
            className={`rounded-2xl border px-3.5 py-2 text-xs font-bold transition-all flex items-center gap-1.5 ${
              isMultiSelectMode
                ? 'bg-psi-vibrant text-white border-psi-vibrant shadow-md'
                : 'bg-white/10 text-white border-white/20 hover:bg-white/20'
            }`}
          >
            <CheckSquare className="w-4 h-4" />
            <span>{isMultiSelectMode ? 'Modo Lote Ativo' : 'Seleção em Lote'}</span>
          </button>
        </div>
      </div>

      {feedbackMessage && (
        <div
          className={`px-6 py-3 text-xs font-bold ${
            feedbackMessage.type === 'ok'
              ? 'bg-emerald-50 text-emerald-800 border-b border-emerald-200'
              : 'bg-rose-50 text-rose-800 border-b border-rose-200'
          }`}
        >
          {feedbackMessage.text}
        </div>
      )}

      {/* Grid Principal: Calendário Mensal + Painel de Ações do Dia Selecionado */}
      <div className="grid grid-cols-1 lg:grid-cols-12 divide-y lg:divide-y-0 lg:divide-x divide-line">
        {/* Lado Esquerdo: Calendário Mensal (Col 7) */}
        <div className="lg:col-span-7 p-6 space-y-4">
          {/* Navegação de Mês */}
          <div className="flex items-center justify-between">
            <button
              type="button"
              onClick={prevMonth}
              className="p-2 rounded-xl border border-slate-200 hover:bg-slate-100 transition-colors"
              aria-label="Mês anterior"
            >
              <ChevronLeft className="w-4 h-4 text-slate-700" />
            </button>
            <h4 className="font-black text-sm text-slate-900 capitalize">
              {formatMonthYear(currentYear, currentMonth)}
            </h4>
            <button
              type="button"
              onClick={nextMonth}
              className="p-2 rounded-xl border border-slate-200 hover:bg-slate-100 transition-colors"
              aria-label="Próximo mês"
            >
              <ChevronRight className="w-4 h-4 text-slate-700" />
            </button>
          </div>

          {/* Atalhos Rápidos de Seleção em Lote */}
          {isMultiSelectMode && (
            <div className="bg-psi-vibrant/5 p-3 rounded-2xl border border-psi-vibrant/20 flex flex-wrap items-center justify-between text-xs gap-2">
              <span className="font-bold text-psi-vibrant text-[11px]">
                {selectedDays.length} dia(s) selecionado(s)
              </span>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={handleSelectWeekdaysMonth}
                  className="text-[11px] font-bold text-slate-700 hover:text-psi-vibrant underline"
                >
                  Selecionar Dias Úteis do Mês
                </button>
                <button
                  type="button"
                  onClick={() => setSelectedDays([])}
                  className="text-[11px] font-bold text-rose-600 hover:underline"
                >
                  Limpar Seleção
                </button>
              </div>
            </div>
          )}

          {/* Cabeçalho dos Dias da Semana */}
          <div className="grid grid-cols-7 gap-1.5 text-center">
            {DIAS_SEMANA.map((d) => (
              <span key={d} className="text-[11px] font-extrabold text-slate-400 py-1 uppercase">
                {d}
              </span>
            ))}

            {/* Células dos Dias */}
            {monthCells.map((dateIso, idx) => {
              if (!dateIso) return <div key={`empty-${idx}`} />;

              const dayNumber = Number(dateIso.slice(8, 10));
              const dayOfWeek = new Date(`${dateIso}T12:00:00Z`).getUTCDay();

              const hasAvailability = (availabilityMap.get(dayOfWeek) || []).length > 0;
              const isBlocked = blockedDatesSet.has(dateIso);
              const dayApps = appointmentsByDate.get(dateIso) || [];
              const isSelected = selectedDays.includes(dateIso);

              return (
                <button
                  key={dateIso}
                  type="button"
                  onClick={() => handleDayClick(dateIso)}
                  className={`aspect-square rounded-2xl p-1 text-xs font-bold transition-all relative flex flex-col items-center justify-between border ${
                    isSelected
                      ? 'bg-psi-vibrant text-white border-psi-vibrant shadow-md scale-105 z-10'
                      : isBlocked
                      ? 'bg-rose-50 text-rose-900 border-rose-200 hover:border-rose-400'
                      : dayApps.length > 0
                      ? 'bg-emerald-50 text-emerald-900 border-emerald-200 hover:border-emerald-400'
                      : hasAvailability
                      ? 'bg-white text-slate-800 border-slate-200 hover:border-psi-vibrant hover:bg-psi-vibrant/5'
                      : 'bg-slate-50 text-slate-400 border-slate-100'
                  }`}
                >
                  <span className="text-xs font-black">{dayNumber}</span>

                  {/* Indicadores Visuais de Status do Dia */}
                  <div className="flex items-center gap-0.5 mt-0.5">
                    {isBlocked && (
                      <span
                        className={`w-2 h-2 rounded-full ${isSelected ? 'bg-white' : 'bg-rose-500'}`}
                        title="Dia Bloqueado"
                      />
                    )}
                    {dayApps.length > 0 && (
                      <span
                        className={`text-[9px] font-black px-1.5 py-0.2 rounded-full ${
                          isSelected ? 'bg-white text-psi-vibrant' : 'bg-emerald-600 text-white'
                        }`}
                      >
                        {dayApps.length}
                      </span>
                    )}
                  </div>
                </button>
              );
            })}
          </div>

          {/* Legenda de Cores */}
          <div className="flex flex-wrap items-center justify-between text-[11px] font-bold text-slate-500 pt-2 border-t border-slate-100">
            <span className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-full bg-white border border-slate-300" /> Atendimento Ativo
            </span>
            <span className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-full bg-emerald-500" /> Sessões Agendadas
            </span>
            <span className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-full bg-rose-500" /> Dia Bloqueado
            </span>
          </div>
        </div>

        {/* Lado Direito: Painel Detalhado do Dia / Operações em Lote (Col 5) */}
        <div className="lg:col-span-5 p-6 bg-canvas/40 space-y-5">
          {/* Caso esteja em Modo de Seleção Múltipla com Dias Selecionados */}
          {isMultiSelectMode && selectedDays.length > 0 ? (
            <div className="space-y-4">
              <div>
                <span className="chip-accent text-[10px]">Ação em Lote</span>
                <h4 className="text-base font-black text-slate-900 mt-1">
                  Modificar {selectedDays.length} Dia(s) Selecionado(s)
                </h4>
                <p className="text-xs text-slate-500">
                  Aplique bloqueio ou regras aos dias marcados no calendário.
                </p>
              </div>

              <div className="space-y-3 bg-white p-4 rounded-2xl border border-slate-200">
                <label className="text-xs font-bold text-slate-700 block">
                  Motivo do Bloqueio em Lote
                  <input
                    type="text"
                    value={batchMotivo}
                    onChange={(e) => setBatchMotivo(e.target.value)}
                    placeholder="Ex: Férias de Julho, Congresso..."
                    className="input mt-1 py-2 text-xs w-full"
                  />
                </label>

                <button
                  type="button"
                  disabled={executingBatch}
                  onClick={handleBloquearDiasSelecionados}
                  className="w-full rounded-2xl bg-rose-600 hover:bg-rose-500 text-white py-3 text-xs font-black flex justify-center items-center gap-2 shadow-md disabled:opacity-50 transition-all"
                >
                  <CalendarOff className="w-4 h-4" />
                  {executingBatch ? 'Processando…' : `Bloquear ${selectedDays.length} Dia(s)`}
                </button>
              </div>
            </div>
          ) : selectedDateSingle ? (
            /* Detalhes de 1 Dia Selecionado */
            <div className="space-y-5 animate-in fade-in duration-200">
              <div className="flex items-center justify-between border-b border-line pb-3">
                <div>
                  <span className="text-[10px] font-black uppercase tracking-wider text-psi-vibrant">
                    Dia Selecionado
                  </span>
                  <h4 className="text-base font-black text-slate-900 capitalize">
                    {new Date(`${selectedDateSingle}T12:00:00Z`).toLocaleDateString('pt-BR', {
                      weekday: 'long',
                      day: '2-digit',
                      month: 'long',
                      year: 'numeric',
                      timeZone: 'UTC',
                    })}
                  </h4>
                </div>
              </div>

              {/* Status do Dia */}
              {singleDayBlock ? (
                <div className="bg-rose-50 border border-rose-200 rounded-2xl p-4 space-y-2 text-rose-900">
                  <div className="flex items-center justify-between">
                    <span className="font-extrabold text-xs flex items-center gap-1.5">
                      <CalendarOff className="w-4 h-4 text-rose-600" /> Período Bloqueado
                    </span>
                    <button
                      type="button"
                      onClick={() => void onRemoverBloqueio(singleDayBlock.id)}
                      className="text-[11px] font-bold text-rose-700 underline hover:text-rose-900"
                    >
                      Remover Bloqueio
                    </button>
                  </div>
                  {singleDayBlock.motivo && <p className="text-xs text-rose-700">{singleDayBlock.motivo}</p>}
                </div>
              ) : (
                <div className="space-y-3">
                  <div className="flex justify-between items-center">
                    <span className="text-xs font-bold text-slate-700">Janela Semanal Recorrente</span>
                    <span className="text-[11px] font-bold text-emerald-700 bg-emerald-50 px-2.5 py-0.5 rounded-full border border-emerald-200">
                      {singleDayWindows.length > 0 ? 'Disponível' : 'Sem atendimento'}
                    </span>
                  </div>

                  {singleDayWindows.map((win, i) => (
                    <div key={i} className="bg-white p-3 rounded-xl border border-slate-200 text-xs flex justify-between font-bold text-slate-800">
                      <span>{win.horaInicio} às {win.horaFim} ({win.duracaoMin} min)</span>
                      <span className="capitalize text-psi-vibrant">{win.modalidade}</span>
                    </div>
                  ))}

                  <button
                    type="button"
                    onClick={() =>
                      onAdicionarBloqueio({
                        inicioDia: selectedDateSingle,
                        fimDia: selectedDateSingle,
                        motivo: 'Bloqueio pontual via calendário',
                      })
                    }
                    className="w-full rounded-2xl border border-rose-200 bg-rose-50 hover:bg-rose-100 p-2.5 text-xs font-bold text-rose-700 flex items-center justify-center gap-1.5 transition-colors"
                  >
                    <CalendarOff className="w-4 h-4 text-rose-600" /> Bloquear este dia
                  </button>
                </div>
              )}

              {/* Sessões Agendadas no Dia */}
              <div className="space-y-3">
                <h5 className="font-extrabold text-xs text-slate-900 flex items-center gap-1.5">
                  <User className="w-4 h-4 text-psi-vibrant" /> Sessões Marcadas no Dia ({singleDayAppointments.length})
                </h5>

                {singleDayAppointments.length === 0 ? (
                  <p className="text-xs text-slate-400 bg-white p-4 rounded-2xl border border-slate-200 text-center">
                    Nenhum atendimento marcado nesta data.
                  </p>
                ) : (
                  singleDayAppointments.map((app) => (
                    <div key={app.id} className="bg-white p-3.5 rounded-2xl border border-slate-200 space-y-1">
                      <div className="flex justify-between items-center">
                        <span className="font-extrabold text-xs text-slate-900">{app.pacienteNome}</span>
                        <span className="text-[10px] font-bold text-psi-vibrant bg-psi-vibrant/10 px-2 py-0.5 rounded-md">
                          {new Date(app.inicio).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit', timeZone: 'America/Sao_Paulo' })}
                        </span>
                      </div>
                      <p className="text-[11px] text-slate-500 capitalize">Modalidade: {app.modalidade}</p>
                    </div>
                  ))
                )}
              </div>
            </div>
          ) : (
            /* Nenhuma Data Selecionada */
            <div className="py-12 text-center space-y-3">
              <div className="w-12 h-12 rounded-2xl bg-psi-vibrant/10 text-psi-vibrant flex items-center justify-center mx-auto">
                <CalendarIcon className="w-6 h-6" />
              </div>
              <h4 className="font-black text-sm text-slate-900">Selecione um Dia no Calendário</h4>
              <p className="text-xs text-slate-500 max-w-xs mx-auto">
                Clique sobre qualquer dia para visualizar as consultas marcadas, adicionar bloqueios pontuais ou editar horários em lote.
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
