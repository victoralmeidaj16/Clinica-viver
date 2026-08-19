'use client';

import { useMemo, useState } from 'react';
import { Calendar as CalendarIcon, CheckSquare, ChevronLeft, ChevronRight, Clock3 } from 'lucide-react';
import type { BloqueioAgenda, NovoBloqueioAgenda } from './AgendaBlocks';
import type { JanelaEditavel } from './AvailabilityEditor';
import type { AgendamentoResumo } from './UpcomingSessions';
import { CalendarBatchPanel } from './CalendarBatchPanel';
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
  availability, blocks, appointments, onAdicionarBloqueio, onRemoverBloqueio,
}: Props) {
  const agora = new Date();
  const [ano, setAno] = useState(agora.getFullYear());
  const [mes, setMes] = useState(agora.getMonth());
  const [selecionados, setSelecionados] = useState<string[]>([]);
  const [modoLote, setModoLote] = useState(false);
  const [motivoLote, setMotivoLote] = useState('');
  const [executandoLote, setExecutandoLote] = useState(false);
  const [atalhoBloqueio, setAtalhoBloqueio] = useState(0);
  const [feedback, setFeedback] = useState<{ tipo: 'ok' | 'erro'; texto: string }>();
  const celulas = useMemo(() => monthCells(ano, mes), [ano, mes]);
  const diasDisponiveis = useMemo(() => new Set(availability.map((janela) => janela.diaSemana)), [availability]);
  const dataSelecionada = selecionados.length === 1 && !modoLote ? selecionados[0] : undefined;
  const janelasSelecionadas = useMemo(() => {
    if (!dataSelecionada) return [];
    const diaSemana = new Date(`${dataSelecionada}T12:00:00Z`).getUTCDay();
    return availability.filter((janela) => janela.diaSemana === diaSemana);
  }, [availability, dataSelecionada]);

  const navegarMes = (direcao: -1 | 1) => {
    const data = new Date(Date.UTC(ano, mes + direcao, 1));
    setAno(data.getUTCFullYear());
    setMes(data.getUTCMonth());
    setSelecionados([]);
  };

  const selecionar = (data: string) => {
    setFeedback(undefined);
    setAtalhoBloqueio(0);
    setSelecionados((atual) => modoLote
      ? atual.includes(data) ? atual.filter((item) => item !== data) : [...atual, data]
      : [data]
    );
  };

  const selecionarDiasUteis = () => {
    setModoLote(true);
    setSelecionados(celulas.filter((data): data is string => {
      if (!data) return false;
      const dia = new Date(`${data}T12:00:00Z`).getUTCDay();
      return dia >= 1 && dia <= 5;
    }));
  };

  const bloquearSelecionados = async () => {
    if (selecionados.length === 0) return;
    setExecutandoLote(true);
    setFeedback(undefined);
    let concluidos = 0;
    try {
      for (const data of [...selecionados].sort()) {
        await onAdicionarBloqueio({
          tipo: 'dia', inicioDia: data, fimDia: data,
          motivo: motivoLote.trim() || 'Bloqueio selecionado pelo calendário',
        });
        concluidos += 1;
      }
      setFeedback({ tipo: 'ok', texto: `${concluidos} ${concluidos === 1 ? 'dia bloqueado' : 'dias bloqueados'} com sucesso.` });
      setSelecionados([]);
      setMotivoLote('');
    } catch (causa) {
      const detalhe = causa instanceof Error ? causa.message : 'Não foi possível concluir os bloqueios.';
      setFeedback({ tipo: 'erro', texto: concluidos > 0 ? `${concluidos} bloqueados antes do conflito. ${detalhe}` : detalhe });
    } finally {
      setExecutandoLote(false);
    }
  };

  const abrirHoje = () => {
    const hoje = dataLocal(Date.now());
    setAno(Number(hoje.slice(0, 4)));
    setMes(Number(hoje.slice(5, 7)) - 1);
    setModoLote(false);
    setSelecionados([hoje]);
    setAtalhoBloqueio((atual) => atual + 1);
  };

  return (
    <section className="overflow-hidden rounded-3xl border border-line bg-surface shadow-card">
      <header className="flex flex-wrap items-center justify-between gap-4 bg-psi-darkest p-5 text-white sm:p-6">
        <div>
          <p className="text-[10px] font-black uppercase tracking-[.2em] text-psi-vibrant">Agenda sem conflitos</p>
          <h2 className="mt-1 flex items-center gap-2 text-lg font-extrabold"><CalendarIcon className="h-5 w-5 text-psi-vibrant" /> Calendário do profissional</h2>
          <p className="mt-1 text-xs text-psi-soft/75">Selecione um dia para bloquear um horário externo sem alterar sua rotina semanal.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button type="button" onClick={abrirHoje} className="flex items-center gap-1.5 rounded-xl bg-psi-vibrant px-3.5 py-2.5 text-xs font-extrabold text-white transition hover:bg-psi-vibrant/90"><Clock3 className="h-4 w-4" /> Bloquear horário</button>
          <button type="button" onClick={() => { setModoLote((atual) => !atual); setSelecionados([]); }} className={`flex items-center gap-1.5 rounded-xl border px-3.5 py-2.5 text-xs font-bold transition ${modoLote ? 'border-white bg-white text-psi-darkest' : 'border-white/20 bg-white/10 text-white hover:bg-white/20'}`}><CheckSquare className="h-4 w-4" /> {modoLote ? 'Sair do lote' : 'Selecionar dias'}</button>
        </div>
      </header>

      {feedback && <div role="status" className={`border-b px-5 py-3 text-xs font-bold ${feedback.tipo === 'ok' ? 'border-emerald-200 bg-emerald-50 text-emerald-800' : 'border-rose-200 bg-rose-50 text-rose-800'}`}>{feedback.texto}</div>}

      <div className="grid divide-y divide-line lg:grid-cols-12 lg:divide-x lg:divide-y-0">
        <div className="space-y-4 p-4 sm:p-6 lg:col-span-7">
          <div className="flex items-center justify-between">
            <button type="button" onClick={() => navegarMes(-1)} aria-label="Mês anterior" className="rounded-xl border border-slate-200 p-2 transition hover:bg-slate-100"><ChevronLeft className="h-4 w-4" /></button>
            <h3 className="text-sm font-black capitalize text-ink">{formatMonthYear(ano, mes)}</h3>
            <button type="button" onClick={() => navegarMes(1)} aria-label="Próximo mês" className="rounded-xl border border-slate-200 p-2 transition hover:bg-slate-100"><ChevronRight className="h-4 w-4" /></button>
          </div>

          {modoLote && (
            <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-psi-vibrant/20 bg-psi-vibrant/5 p-3 text-[11px] font-bold">
              <span className="text-psi-deep">{selecionados.length} dias selecionados</span>
              <span className="flex gap-3"><button type="button" onClick={selecionarDiasUteis} className="underline">Dias úteis</button><button type="button" onClick={() => setSelecionados([])} className="text-rose-600 underline">Limpar</button></span>
            </div>
          )}

          <CalendarMonthGrid celulas={celulas} diasDisponiveis={diasDisponiveis} bloqueios={blocks} agendamentos={appointments} selecionados={selecionados} onSelecionar={selecionar} />
        </div>

        <aside className="space-y-5 bg-canvas/40 p-4 sm:p-6 lg:col-span-5">
          {modoLote && selecionados.length > 0 ? (
            <CalendarBatchPanel quantidade={selecionados.length} motivo={motivoLote} executando={executandoLote} onMotivo={setMotivoLote} onBloquear={() => void bloquearSelecionados()} />
          ) : dataSelecionada ? (
            <DaySchedulePanel key={`${dataSelecionada}-${atalhoBloqueio}`} data={dataSelecionada} janelas={janelasSelecionadas} bloqueios={blocks} agendamentos={appointments} onAdicionar={onAdicionarBloqueio} onRemover={onRemoverBloqueio} abrirFormulario={atalhoBloqueio > 0} />
          ) : (
            <div className="space-y-3 py-12 text-center">
              <span className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-psi-vibrant/10 text-psi-vibrant"><CalendarIcon className="h-6 w-6" /></span>
              <h3 className="text-sm font-black text-ink">Selecione um dia</h3>
              <p className="mx-auto max-w-xs text-xs text-muted">Você verá os horários livres, sessões marcadas e bloqueios pontuais daquela data.</p>
            </div>
          )}
        </aside>
      </div>
    </section>
  );
}
