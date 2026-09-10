'use client';

import type { BloqueioAgenda } from './AgendaBlocks';
import type { AgendamentoResumo } from './UpcomingSessions';
import { blocosDaData, dataLocal, DIAS_SEMANA, sessoesDaData } from './agendaCalendarModel';

interface Props {
  celulas: readonly (string | null)[];
  diasDisponiveis: ReadonlySet<number>;
  bloqueios: readonly BloqueioAgenda[];
  agendamentos: readonly AgendamentoResumo[];
  selecionados: readonly string[];
  hoje?: string;
  onSelecionar: (data: string) => void;
}

export function CalendarMonthGrid({ celulas, diasDisponiveis, bloqueios, agendamentos, selecionados, hoje, onSelecionar }: Props) {
  const hojeCalculado = hoje ?? dataLocal(Date.now());

  return (
    <>
      <div className="grid grid-cols-7 gap-1.5 text-center">
        {DIAS_SEMANA.map((dia) => <span key={dia} className="py-1 text-[11px] font-extrabold uppercase text-slate-400">{dia}</span>)}
        {celulas.map((data, indice) => {
          if (!data) return <div key={`empty-${indice}`} />;
          const sessoes = sessoesDaData(agendamentos, data);
          const totalBloqueios = blocosDaData(bloqueios, data).length;
          const selecionado = selecionados.includes(data);
          const eHoje = data === hojeCalculado;
          const disponivel = diasDisponiveis.has(new Date(`${data}T12:00:00Z`).getUTCDay());
          return (
            <button
              key={data}
              type="button"
              onClick={() => onSelecionar(data)}
              aria-label={`${data}${eHoje ? ', hoje' : ''}${sessoes.length ? `, ${sessoes.length} sessões` : ''}${totalBloqueios ? `, ${totalBloqueios} bloqueios` : ''}`}
              className={`relative flex aspect-square flex-col items-center justify-between rounded-2xl border p-1 text-xs font-bold transition-all ${
                selecionado ? 'z-10 scale-105 border-psi-vibrant bg-psi-vibrant text-white shadow-md' :
                eHoje ? 'border-psi-vibrant/70 bg-psi-vibrant/10 text-psi-darkest ring-2 ring-psi-vibrant/40 font-black' :
                sessoes.length > 0 ? 'border-emerald-200 bg-emerald-50 text-emerald-900 hover:border-emerald-400' :
                totalBloqueios > 0 ? 'border-amber-200 bg-amber-50 text-amber-950 hover:border-amber-400' :
                disponivel ? 'border-slate-200 bg-white text-slate-800 hover:border-psi-vibrant hover:bg-psi-vibrant/5' :
                'border-slate-100 bg-slate-50 text-slate-400'
              }`}
            >
              <div className="flex items-center gap-1">
                <span className="font-black">{Number(data.slice(8, 10))}</span>
                {eHoje && (
                  <span className={`rounded px-1 text-[8px] font-black uppercase tracking-wider ${
                    selecionado ? 'bg-white/25 text-white' : 'bg-psi-vibrant text-white'
                  }`}>
                    Hoje
                  </span>
                )}
              </div>
              <span className="flex items-center gap-0.5">
                {totalBloqueios > 0 && <span className={`h-2 w-2 rounded-full ${selecionado ? 'bg-white' : 'bg-amber-500'}`} />}
                {sessoes.length > 0 && <span className={`rounded-full px-1.5 text-[9px] font-black ${selecionado ? 'bg-white text-psi-vibrant' : 'bg-emerald-600 text-white'}`}>{sessoes.length}</span>}
              </span>
            </button>
          );
        })}
      </div>
      <div className="flex flex-wrap items-center justify-between gap-2 border-t border-slate-100 pt-3 text-[10px] font-bold text-slate-500">
        <span className="flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-full border border-psi-vibrant bg-psi-vibrant/20" /> Hoje</span>
        <span className="flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-full border border-slate-300 bg-white" /> Disponível</span>
        <span className="flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-full bg-emerald-500" /> Sessão</span>
        <span className="flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-full bg-amber-500" /> Bloqueio</span>
      </div>
    </>
  );
}
