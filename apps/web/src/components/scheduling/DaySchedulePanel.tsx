'use client';

import { useMemo, useState } from 'react';
import { CalendarIcon, ChevronDown, ChevronUp, X } from 'lucide-react';
import type { BloqueioAgenda, NovoBloqueioAgenda } from './AgendaBlocks';
import type { JanelaEditavel } from './AvailabilityEditor';
import type { AgendamentoResumo } from './UpcomingSessions';
import { BatchBlockConfirmationBar } from './BatchBlockConfirmationBar';
import { SelectedDayAccordion } from './SelectedDayAccordion';
import type { SlotDoDia } from './agendaCalendarModel';

interface Props {
  datas: readonly string[];
  availability: readonly JanelaEditavel[];
  bloqueios: readonly BloqueioAgenda[];
  agendamentos: readonly AgendamentoResumo[];
  onAdicionar: (input: NovoBloqueioAgenda) => Promise<void>;
  onRemover: (id: string) => Promise<void>;
  onRemoverData: (data: string) => void;
  onLimparTodasDatas: () => void;
}

interface ItemSlotSelecionado {
  data: string;
  horaInicio: string;
  horaFim: string;
}

export function DaySchedulePanel({
  datas,
  availability,
  bloqueios,
  agendamentos,
  onAdicionar,
  onRemover,
  onRemoverData,
  onLimparTodasDatas,
}: Props) {
  // Começa vazio: todos os dias selecionados aparecem MAXIMIZADOS por padrão!
  const [diasRecolhidos, setDiasRecolhidos] = useState<Set<string>>(new Set());
  const [horariosSelecionados, setHorariosSelecionados] = useState<Map<string, ItemSlotSelecionado>>(new Map());
  const [motivoLote, setMotivoLote] = useState('');
  const [executandoLote, setExecutandoLote] = useState(false);
  const [feedback, setFeedback] = useState<{ tipo: 'ok' | 'erro'; texto: string }>();

  const datasOrdenadas = useMemo(() => [...datas].sort(), [datas]);
  const chavesSelecionadasSet = useMemo(() => new Set(horariosSelecionados.keys()), [horariosSelecionados]);

  const diasComHorariosSelecionados = useMemo(() => {
    const conjunto = new Set<string>();
    for (const item of horariosSelecionados.values()) conjunto.add(item.data);
    return conjunto.size;
  }, [horariosSelecionados]);

  const alternarRecolhido = (data: string) => {
    setDiasRecolhidos((atual) => {
      const proximo = new Set(atual);
      if (proximo.has(data)) proximo.delete(data);
      else proximo.add(data);
      return proximo;
    });
  };

  const alternarSlot = (data: string, slot: SlotDoDia) => {
    setFeedback(undefined);
    const chave = `${data}_${slot.horaInicio}`;
    setHorariosSelecionados((atual) => {
      const proximo = new Map(atual);
      if (proximo.has(chave)) proximo.delete(chave);
      else proximo.set(chave, { data, horaInicio: slot.horaInicio, horaFim: slot.horaFim });
      return proximo;
    });
  };

  const selecionarTodosLivres = (data: string, slotsLivres: SlotDoDia[]) => {
    setFeedback(undefined);
    setHorariosSelecionados((atual) => {
      const proximo = new Map(atual);
      for (const slot of slotsLivres) {
        proximo.set(`${data}_${slot.horaInicio}`, {
          data,
          horaInicio: slot.horaInicio,
          horaFim: slot.horaFim,
        });
      }
      return proximo;
    });
  };

  const desmarcarTodosDia = (data: string) => {
    setFeedback(undefined);
    setHorariosSelecionados((atual) => {
      const proximo = new Map(atual);
      for (const chave of atual.keys()) {
        if (chave.startsWith(`${data}_`)) proximo.delete(chave);
      }
      return proximo;
    });
  };

  const bloquearDia = async (data: string) => {
    setFeedback(undefined);
    await onAdicionar({
      tipo: 'dia',
      inicioDia: data,
      fimDia: data,
      motivo: 'Bloqueio do dia via calendário',
    });
    setFeedback({ tipo: 'ok', texto: 'Dia bloqueado com sucesso.' });
  };

  const bloquearHorariosSelecionados = async () => {
    if (horariosSelecionados.size === 0) return;
    setExecutandoLote(true);
    setFeedback(undefined);
    let concluidos = 0;
    try {
      for (const item of Array.from(horariosSelecionados.values())) {
        await onAdicionar({
          tipo: 'horario',
          data: item.data,
          horaInicio: item.horaInicio,
          horaFim: item.horaFim,
          motivo: motivoLote.trim() || 'Bloqueio de horário via calendário',
        });
        concluidos += 1;
      }
      setFeedback({
        tipo: 'ok',
        texto: `${concluidos} ${concluidos === 1 ? 'horário bloqueado' : 'horários bloqueados'} com sucesso.`,
      });
      setHorariosSelecionados(new Map());
      setMotivoLote('');
    } catch (causa) {
      const detalhe = causa instanceof Error ? causa.message : 'Não foi possível bloquear os horários.';
      setFeedback({
        tipo: 'erro',
        texto: concluidos > 0 ? `${concluidos} bloqueados antes da interrupção. ${detalhe}` : detalhe,
      });
    } finally {
      setExecutandoLote(false);
    }
  };

  if (datas.length === 0) {
    return (
      <div className="space-y-3 py-12 text-center">
        <span className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-psi-vibrant/10 text-psi-vibrant">
          <CalendarIcon className="h-6 w-6" />
        </span>
        <h3 className="text-sm font-black text-ink">Nenhum dia selecionado</h3>
        <p className="mx-auto max-w-xs text-xs text-muted">
          Clique em uma ou mais datas no calendário para visualizar os horários e fechar períodos da sua agenda.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4 animate-in fade-in duration-200">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-line pb-3">
        <div>
          <p className="text-[10px] font-black uppercase tracking-[.16em] text-psi-vibrant">Agenda do dia</p>
          <h4 className="mt-0.5 text-base font-black text-ink">
            {datas.length} {datas.length === 1 ? 'dia selecionado' : 'dias selecionados'}
          </h4>
        </div>

        <div className="flex items-center gap-1.5 text-[11px] font-bold">
          <button
            type="button"
            onClick={() => setDiasRecolhidos(new Set())}
            className="flex items-center gap-1 rounded-lg px-2 py-1 text-slate-600 transition hover:bg-slate-100"
          >
            <ChevronDown className="h-3.5 w-3.5" /> Expandir
          </button>
          <button
            type="button"
            onClick={() => setDiasRecolhidos(new Set(datas))}
            className="flex items-center gap-1 rounded-lg px-2 py-1 text-slate-600 transition hover:bg-slate-100"
          >
            <ChevronUp className="h-3.5 w-3.5" /> Recolher
          </button>
          <button
            type="button"
            onClick={onLimparTodasDatas}
            className="flex items-center gap-1 rounded-lg px-2 py-1 text-rose-600 transition hover:bg-rose-50"
          >
            <X className="h-3.5 w-3.5" /> Limpar
          </button>
        </div>
      </div>

      {feedback && (
        <div
          role="status"
          className={`rounded-xl border p-3 text-xs font-bold ${
            feedback.tipo === 'ok'
              ? 'border-emerald-200 bg-emerald-50 text-emerald-800'
              : 'border-rose-200 bg-rose-50 text-rose-800'
          }`}
        >
          {feedback.texto}
        </div>
      )}

      <BatchBlockConfirmationBar
        totalHorarios={horariosSelecionados.size}
        totalDias={diasComHorariosSelecionados}
        motivo={motivoLote}
        executando={executandoLote}
        onMotivoChange={setMotivoLote}
        onConfirmar={() => void bloquearHorariosSelecionados()}
        onDesmarcarTodos={() => setHorariosSelecionados(new Map())}
      />

      <div className="space-y-3">
        {datasOrdenadas.map((data) => {
          const diaSemana = new Date(`${data}T12:00:00Z`).getUTCDay();
          const janelas = availability.filter((j) => j.diaSemana === diaSemana);
          return (
            <SelectedDayAccordion
              key={data}
              data={data}
              janelas={janelas}
              bloqueios={bloqueios}
              agendamentos={agendamentos}
              recolhido={diasRecolhidos.has(data)}
              horariosSelecionados={chavesSelecionadasSet}
              onAlternarRecolhido={alternarRecolhido}
              onAlternarSlot={alternarSlot}
              onSelecionarTodosLivres={selecionarTodosLivres}
              onDesmarcarTodosDia={desmarcarTodosDia}
              onBloquearDia={bloquearDia}
              onRemoverBloqueio={onRemover}
              onRemoverData={onRemoverData}
            />
          );
        })}
      </div>
    </div>
  );
}
