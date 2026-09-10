'use client';

import { useMemo, useState } from 'react';
import {
  CalendarOff,
  CheckSquare,
  ChevronDown,
  ChevronUp,
  Clock3,
  LockKeyhole,
  Square,
  Unlock,
  User,
  X,
} from 'lucide-react';
import type { BloqueioAgenda } from './AgendaBlocks';
import type { JanelaEditavel } from './AvailabilityEditor';
import type { AgendamentoResumo } from './UpcomingSessions';
import {
  blocosDaData,
  colide,
  dataLocal,
  dataPorExtenso,
  horaLocal,
  sessoesDaData,
  slotsDaData,
  type SlotDoDia,
} from './agendaCalendarModel';

interface Props {
  data: string;
  janelas: readonly JanelaEditavel[];
  bloqueios: readonly BloqueioAgenda[];
  agendamentos: readonly AgendamentoResumo[];
  recolhido: boolean;
  horariosSelecionados: ReadonlySet<string>;
  onAlternarRecolhido: (data: string) => void;
  onAlternarSlot: (data: string, slot: SlotDoDia) => void;
  onSelecionarTodosLivres: (data: string, slotsLivres: SlotDoDia[]) => void;
  onDesmarcarTodosDia: (data: string) => void;
  onBloquearDia: (data: string) => Promise<void>;
  onRemoverBloqueio: (id: string) => Promise<void>;
  onRemoverData: (data: string) => void;
}

export function SelectedDayAccordion({
  data,
  janelas,
  bloqueios,
  agendamentos,
  recolhido,
  horariosSelecionados,
  onAlternarRecolhido,
  onAlternarSlot,
  onSelecionarTodosLivres,
  onDesmarcarTodosDia,
  onBloquearDia,
  onRemoverBloqueio,
  onRemoverData,
}: Props) {
  const [agora] = useState(() => Date.now());
  const [bloqueandoDia, setBloqueandoDia] = useState(false);
  const [erroDia, setErroDia] = useState<string>();

  const slots = useMemo(() => slotsDaData(data, janelas), [data, janelas]);
  const blocos = useMemo(() => blocosDaData(bloqueios, data), [bloqueios, data]);
  const sessoes = useMemo(() => sessoesDaData(agendamentos, data), [agendamentos, data]);

  const slotsLivres = useMemo(() => {
    return slots.filter((slot) => {
      const temSessao = sessoes.some((item) => colide(slot.inicio, slot.fim, item));
      const temBloqueio = blocos.some((item) => colide(slot.inicio, slot.fim, item));
      const encerrado = Date.parse(slot.fim) <= agora;
      return !temSessao && !temBloqueio && !encerrado;
    });
  }, [slots, sessoes, blocos, agora]);

  const selecionadosNesteDia = useMemo(() => {
    return slots.filter((slot) => horariosSelecionados.has(`${data}_${slot.horaInicio}`));
  }, [slots, horariosSelecionados, data]);

  const todosLivresSelecionados =
    slotsLivres.length > 0 && selecionadosNesteDia.length === slotsLivres.length;

  const handleBloquearDia = async () => {
    try {
      setBloqueandoDia(true);
      setErroDia(undefined);
      await onBloquearDia(data);
    } catch (causa) {
      setErroDia(causa instanceof Error ? causa.message : 'Não foi possível bloquear este dia.');
    } finally {
      setBloqueandoDia(false);
    }
  };

  return (
    <article className="overflow-hidden rounded-2xl border border-line bg-white shadow-xs transition-all">
      {/* CABEÇALHO DO DIA (CLICÁVEL PARA EXPANDIR / RECOLHER) */}
      <header className="flex items-center justify-between gap-2 border-b border-slate-100 bg-slate-50/75 p-3 sm:px-4">
        <button
          type="button"
          onClick={() => onAlternarRecolhido(data)}
          className="flex min-w-0 flex-1 items-center gap-2.5 text-left transition hover:opacity-85"
        >
          <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-lg bg-white text-slate-600 shadow-2xs">
            {recolhido ? <ChevronDown className="h-4 w-4" /> : <ChevronUp className="h-4 w-4" />}
          </span>
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <h4 className="truncate text-xs font-black capitalize text-ink">
                {dataPorExtenso(data)}
              </h4>
              {data === dataLocal(Date.now()) && (
                <span className="shrink-0 rounded-md bg-psi-vibrant/10 px-1.5 py-0.5 text-[9px] font-black uppercase tracking-wide text-psi-vibrant">
                  Hoje
                </span>
              )}
            </div>
            <div className="mt-0.5 flex flex-wrap items-center gap-1.5 text-[10px]">
              {selecionadosNesteDia.length > 0 && (
                <span className="rounded-full bg-psi-vibrant px-2 py-0.2 font-extrabold text-white">
                  {selecionadosNesteDia.length} selecionado{selecionadosNesteDia.length > 1 ? 's' : ''}
                </span>
              )}
              {blocos.length > 0 && (
                <span className="rounded-full bg-amber-100 px-2 py-0.2 font-bold text-amber-800">
                  {blocos.length} bloqueio{blocos.length > 1 ? 's' : ''}
                </span>
              )}
              {sessoes.length > 0 && (
                <span className="rounded-full bg-emerald-100 px-2 py-0.2 font-bold text-emerald-800">
                  {sessoes.length} sessão{sessoes.length > 1 ? 'ões' : ''}
                </span>
              )}
              <span className="font-semibold text-muted">
                {slotsLivres.length} livre{slotsLivres.length === 1 ? '' : 's'}
              </span>
            </div>
          </div>
        </button>

        <button
          type="button"
          onClick={() => onRemoverData(data)}
          title="Remover data da lista"
          className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg text-slate-400 transition hover:bg-rose-50 hover:text-rose-600"
        >
          <X className="h-4 w-4" />
        </button>
      </header>

      {/* CONTEÚDO EXPANDIDO */}
      {!recolhido && (
        <div className="space-y-4 p-4 text-xs">
          {/* ATALHOS RÁPIDOS DO DIA */}
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 pb-3">
            <button
              type="button"
              disabled={slotsLivres.length === 0}
              onClick={() => {
                if (todosLivresSelecionados) {
                  onDesmarcarTodosDia(data);
                } else {
                  onSelecionarTodosLivres(data, slotsLivres);
                }
              }}
              className="flex items-center gap-1.5 rounded-lg border border-psi-vibrant/30 bg-psi-vibrant/5 px-2.5 py-1.5 text-[11px] font-bold text-psi-deep transition hover:bg-psi-vibrant/10 disabled:opacity-40"
            >
              <CheckSquare className="h-3.5 w-3.5 text-psi-vibrant" />
              {todosLivresSelecionados
                ? 'Desmarcar horários deste dia'
                : `Selecionar todos os livres (${slotsLivres.length})`}
            </button>

            <button
              type="button"
              disabled={bloqueandoDia}
              onClick={() => void handleBloquearDia()}
              className="flex items-center gap-1.5 rounded-lg border border-rose-200 bg-rose-50 px-2.5 py-1.5 text-[11px] font-bold text-rose-700 transition hover:bg-rose-100 disabled:opacity-50"
            >
              <CalendarOff className="h-3.5 w-3.5" />
              {bloqueandoDia ? 'Bloqueando…' : 'Bloquear dia inteiro'}
            </button>
          </div>

          {erroDia && (
            <p role="alert" className="rounded-xl bg-rose-50 p-2.5 text-[11px] font-bold text-rose-700">
              {erroDia}
            </p>
          )}

          {/* GRADE DE HORÁRIOS */}
          <div className="space-y-2">
            <div className="flex items-center justify-between text-[11px] font-extrabold text-ink">
              <span className="flex items-center gap-1">
                <Clock3 className="h-3.5 w-3.5 text-psi-vibrant" /> Horários da grade
              </span>
              <span className="font-medium text-muted">{slots.length} totais</span>
            </div>

            {slots.length === 0 ? (
              <p className="rounded-xl border border-dashed border-slate-200 bg-slate-50 p-3 text-center text-[11px] text-muted">
                Este dia não possui disponibilidade cadastrada na rotina semanal.
              </p>
            ) : (
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                {slots.map((slot) => {
                  const sessao = sessoes.find((item) => colide(slot.inicio, slot.fim, item));
                  const bloqueio = blocos.find((item) => colide(slot.inicio, slot.fim, item));
                  const encerrado = Date.parse(slot.fim) <= agora;
                  const chave = `${data}_${slot.horaInicio}`;
                  const selecionado = horariosSelecionados.has(chave);

                  if (sessao) {
                    return (
                      <div
                        key={slot.inicio}
                        title={`Sessão confirmada com ${sessao.pacienteNome}`}
                        className="flex cursor-not-allowed flex-col rounded-xl border border-emerald-200 bg-emerald-50/80 p-2 text-left"
                      >
                        <span className="text-xs font-black text-emerald-950">{slot.horaInicio}</span>
                        <span className="mt-0.5 truncate text-[9px] font-bold text-emerald-800">
                          Sessão: {sessao.pacienteNome}
                        </span>
                      </div>
                    );
                  }

                  if (bloqueio) {
                    return (
                      <div
                        key={slot.inicio}
                        title={bloqueio.motivo || 'Horário já bloqueado'}
                        className="flex cursor-not-allowed flex-col rounded-xl border border-amber-200 bg-amber-50/80 p-2 text-left"
                      >
                        <span className="flex items-center justify-between text-xs font-black text-amber-950">
                          {slot.horaInicio}
                          <LockKeyhole className="h-3 w-3 text-amber-600" />
                        </span>
                        <span className="mt-0.5 truncate text-[9px] font-bold text-amber-800">
                          {bloqueio.motivo || 'Bloqueado'}
                        </span>
                      </div>
                    );
                  }

                  if (encerrado) {
                    return (
                      <div
                        key={slot.inicio}
                        className="flex cursor-not-allowed flex-col rounded-xl border border-slate-100 bg-slate-50 p-2 text-left text-slate-400"
                      >
                        <span className="text-xs font-bold">{slot.horaInicio}</span>
                        <span className="mt-0.5 text-[9px]">Encerrado</span>
                      </div>
                    );
                  }

                  // SLOT LIVRE: SELECIONÁVEL PARA BLOQUEIO
                  return (
                    <button
                      key={slot.inicio}
                      type="button"
                      onClick={() => onAlternarSlot(data, slot)}
                      className={`flex flex-col rounded-xl border p-2 text-left transition-all ${
                        selecionado
                          ? 'border-psi-vibrant bg-psi-vibrant/10 ring-2 ring-psi-vibrant/30'
                          : 'border-slate-200 bg-white hover:border-psi-vibrant hover:bg-slate-50'
                      }`}
                    >
                      <span className="flex items-center justify-between text-xs font-black text-ink">
                        {slot.horaInicio}
                        {selecionado ? (
                          <CheckSquare className="h-4 w-4 text-psi-vibrant" />
                        ) : (
                          <Square className="h-4 w-4 text-slate-300" />
                        )}
                      </span>
                      <span className="mt-0.5 text-[9px] font-semibold text-muted">
                        {selecionado ? 'Marcado para fechar' : `Livre até ${slot.horaFim}`}
                      </span>
                    </button>
                  );
                })}
              </div>
            )}
          </div>

          {/* BLOQUEIOS EXISTENTES NESTE DIA */}
          {blocos.length > 0 && (
            <div className="space-y-1.5 border-t border-slate-100 pt-3">
              <h5 className="flex items-center gap-1.5 text-[11px] font-extrabold text-amber-950">
                <LockKeyhole className="h-3.5 w-3.5 text-amber-600" /> Bloqueios ativos neste dia
              </h5>
              <div className="space-y-1">
                {blocos.map((b) => (
                  <div
                    key={b.id}
                    className="flex items-center justify-between gap-2 rounded-lg border border-amber-200 bg-amber-50 px-2.5 py-1.5 text-[11px]"
                  >
                    <div className="min-w-0">
                      <span className="font-black text-amber-950">
                        {horaLocal(b.inicio) === '00:00' && horaLocal(b.fim) === '00:00'
                          ? 'Dia inteiro'
                          : `${horaLocal(b.inicio)}–${horaLocal(b.fim)}`}
                      </span>
                      {b.motivo && <span className="ml-1.5 truncate text-amber-800">({b.motivo})</span>}
                    </div>
                    <button
                      type="button"
                      onClick={() => void onRemoverBloqueio(b.id)}
                      className="flex items-center gap-1 rounded-md px-1.5 py-0.5 text-[10px] font-bold text-amber-950 hover:bg-amber-100"
                    >
                      <Unlock className="h-3 w-3" /> Liberar
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* SESSÕES EXISTENTES NESTE DIA */}
          {sessoes.length > 0 && (
            <div className="space-y-1.5 border-t border-slate-100 pt-3">
              <h5 className="flex items-center gap-1.5 text-[11px] font-extrabold text-emerald-950">
                <User className="h-3.5 w-3.5 text-emerald-600" /> Sessões agendadas ({sessoes.length})
              </h5>
              <div className="space-y-1">
                {sessoes.map((s) => (
                  <div
                    key={s.id}
                    className="flex items-center justify-between rounded-lg border border-emerald-200 bg-emerald-50 px-2.5 py-1.5 text-[11px]"
                  >
                    <span className="font-black text-emerald-950">{s.pacienteNome}</span>
                    <span className="font-bold text-emerald-800">{horaLocal(s.inicio)}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </article>
  );
}
