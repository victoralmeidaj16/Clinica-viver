'use client';

import { useMemo, useState } from 'react';
import { CalendarOff, Clock3, LockKeyhole, Plus, Unlock, User } from 'lucide-react';
import type { BloqueioAgenda, NovoBloqueioAgenda } from './AgendaBlocks';
import type { JanelaEditavel } from './AvailabilityEditor';
import type { AgendamentoResumo } from './UpcomingSessions';
import { TimeBlockForm } from './TimeBlockForm';
import {
  blocosDaData, colide, dataPorExtenso, horaLocal, sessoesDaData, slotsDaData, type SlotDoDia,
} from './agendaCalendarModel';

interface Props {
  data: string;
  janelas: readonly JanelaEditavel[];
  bloqueios: readonly BloqueioAgenda[];
  agendamentos: readonly AgendamentoResumo[];
  onAdicionar: (input: NovoBloqueioAgenda) => Promise<void>;
  onRemover: (id: string) => Promise<void>;
  abrirFormulario?: boolean;
}

export function DaySchedulePanel({ data, janelas, bloqueios, agendamentos, onAdicionar, onRemover, abrirFormulario }: Props) {
  const [agora] = useState(() => Date.now());
  const [selecionado, setSelecionado] = useState<SlotDoDia | 'personalizado' | undefined>(abrirFormulario ? 'personalizado' : undefined);
  const [erro, setErro] = useState<string>();
  const [bloqueandoDia, setBloqueandoDia] = useState(false);
  const slots = useMemo(() => slotsDaData(data, janelas), [data, janelas]);
  const blocos = useMemo(() => blocosDaData(bloqueios, data), [bloqueios, data]);
  const sessoes = useMemo(() => sessoesDaData(agendamentos, data), [agendamentos, data]);

  const bloquearDia = async () => {
    try {
      setBloqueandoDia(true);
      setErro(undefined);
      await onAdicionar({ tipo: 'dia', inicioDia: data, fimDia: data, motivo: 'Bloqueio pontual via calendário' });
    } catch (causa) {
      setErro(causa instanceof Error ? causa.message : 'Não foi possível bloquear o dia.');
    } finally {
      setBloqueandoDia(false);
    }
  };

  return (
    <div className="space-y-5 animate-in fade-in duration-200">
      <div className="border-b border-line pb-3">
        <p className="text-[10px] font-black uppercase tracking-[.16em] text-psi-vibrant">Agenda do dia</p>
        <h4 className="mt-1 text-base font-black capitalize text-ink">{dataPorExtenso(data)}</h4>
        <p className="mt-1 text-[11px] text-muted">Clique em um horário livre para criar uma exceção.</p>
      </div>

      <div className="flex flex-wrap gap-2">
        <button type="button" onClick={() => setSelecionado('personalizado')} className="btn-primary px-3 py-2 text-xs"><Plus className="h-4 w-4" /> Bloquear horário</button>
        <button type="button" onClick={() => void bloquearDia()} disabled={bloqueandoDia} className="btn-outline px-3 py-2 text-xs text-rose-700"><CalendarOff className="h-4 w-4" /> {bloqueandoDia ? 'Bloqueando…' : 'Bloquear dia inteiro'}</button>
      </div>

      {selecionado && (
        <TimeBlockForm
          key={selecionado === 'personalizado' ? 'personalizado' : selecionado.inicio}
          data={data}
          horaInicio={selecionado === 'personalizado' ? undefined : selecionado.horaInicio}
          horaFim={selecionado === 'personalizado' ? undefined : selecionado.horaFim}
          onAdicionar={onAdicionar}
          onCancelar={() => setSelecionado(undefined)}
        />
      )}
      {erro && <p role="alert" className="rounded-xl bg-rose-50 px-3 py-2 text-[11px] font-bold text-rose-700">{erro}</p>}

      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <h5 className="flex items-center gap-1.5 text-xs font-extrabold text-ink"><Clock3 className="h-4 w-4 text-psi-vibrant" /> Horários do dia</h5>
          <span className="text-[10px] font-bold text-muted">{slots.length} na grade</span>
        </div>
        {slots.length === 0 ? (
          <p className="rounded-xl border border-line bg-white p-4 text-center text-xs text-muted">Este dia não possui disponibilidade recorrente.</p>
        ) : (
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-2 xl:grid-cols-3">
            {slots.map((slot) => {
              const sessao = sessoes.find((item) => colide(slot.inicio, slot.fim, item));
              const bloqueio = blocos.find((item) => colide(slot.inicio, slot.fim, item));
              const encerrado = Date.parse(slot.fim) <= agora;
              const ocupado = Boolean(sessao || bloqueio || encerrado);
              return (
                <button
                  key={slot.inicio}
                  type="button"
                  disabled={ocupado}
                  onClick={() => setSelecionado(slot)}
                  title={sessao ? `Sessão com ${sessao.pacienteNome}` : bloqueio?.motivo ?? (encerrado ? 'Horário encerrado' : 'Bloquear este horário')}
                  className={`rounded-xl border px-3 py-2.5 text-left transition ${
                    sessao ? 'border-emerald-200 bg-emerald-50 text-emerald-900' :
                    bloqueio ? 'border-amber-200 bg-amber-50 text-amber-900' : encerrado ? 'border-slate-100 bg-slate-50 text-slate-400' :
                    'border-line bg-white text-ink hover:border-amber-400 hover:bg-amber-50'
                  }`}
                >
                  <span className="flex items-center justify-between text-xs font-extrabold">
                    {slot.horaInicio}<span>{ocupado ? <LockKeyhole className="h-3.5 w-3.5" /> : <Plus className="h-3.5 w-3.5 text-amber-600" />}</span>
                  </span>
                  <span className="mt-0.5 block truncate text-[9px] font-semibold opacity-75">{sessao ? 'Sessão marcada' : bloqueio ? 'Bloqueado' : encerrado ? 'Encerrado' : `Livre até ${slot.horaFim}`}</span>
                </button>
              );
            })}
          </div>
        )}
      </div>

      {blocos.length > 0 && (
        <div className="space-y-2">
          <h5 className="flex items-center gap-1.5 text-xs font-extrabold text-ink"><LockKeyhole className="h-4 w-4 text-amber-600" /> Bloqueios nesta data</h5>
          {blocos.map((bloqueio) => (
            <div key={bloqueio.id} className="flex items-center justify-between gap-3 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2.5">
              <div className="min-w-0">
                <p className="text-xs font-extrabold text-amber-950">{
                  horaLocal(bloqueio.inicio) === '00:00' && horaLocal(bloqueio.fim) === '00:00'
                    ? 'Dia inteiro'
                    : `${horaLocal(bloqueio.inicio)}–${horaLocal(bloqueio.fim)}`
                }</p>
                <p className="truncate text-[10px] text-amber-800">{bloqueio.motivo || 'Indisponível'}</p>
              </div>
              <button type="button" onClick={() => void onRemover(bloqueio.id)} className="flex shrink-0 items-center gap-1 rounded-lg px-2 py-1.5 text-[10px] font-bold text-amber-900 hover:bg-amber-100"><Unlock className="h-3.5 w-3.5" /> Liberar</button>
            </div>
          ))}
        </div>
      )}

      <div className="space-y-2">
        <h5 className="flex items-center gap-1.5 text-xs font-extrabold text-ink"><User className="h-4 w-4 text-psi-vibrant" /> Sessões da clínica ({sessoes.length})</h5>
        {sessoes.length === 0 ? <p className="rounded-xl border border-line bg-white p-3 text-center text-[11px] text-muted">Nenhuma sessão marcada nesta data.</p> : sessoes.map((sessao) => (
          <div key={sessao.id} className="flex items-center justify-between rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2.5 text-xs">
            <span className="font-extrabold text-emerald-950">{sessao.pacienteNome}</span>
            <span className="font-bold text-emerald-800">{horaLocal(sessao.inicio)}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
