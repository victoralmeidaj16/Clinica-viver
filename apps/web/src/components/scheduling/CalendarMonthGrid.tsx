'use client';

import type { AgendamentoResumo } from './UpcomingSessions';
import { DIAS_SEMANA, sessoesDaData } from './agendaCalendarModel';

interface Props {
  celulas: readonly (string | null)[];
  agendamentos: readonly AgendamentoResumo[];
  selecionado: string;
  hoje?: string;
  onSelecionar: (data: string) => void;
}

export function CalendarMonthGrid({ celulas, agendamentos, selecionado, hoje = '', onSelecionar }: Props) {
  return (
    <>
      <div className="grid grid-cols-7 gap-1.5 text-center">
        {DIAS_SEMANA.map((dia) => (
          <span key={dia} className="py-1 text-[10px] font-extrabold uppercase text-slate-400">{dia}</span>
        ))}
        {celulas.map((data, indice) => {
          if (!data) return <div key={`empty-${indice}`} />;
          const totalSessoes = sessoesDaData(agendamentos, data).length;
          const estaSelecionado = selecionado === data;
          const eHoje = data === hoje;
          return (
            <button
              key={data}
              type="button"
              onClick={() => onSelecionar(data)}
              aria-label={`${data}${eHoje ? ', hoje' : ''}${totalSessoes ? `, ${totalSessoes} sessões` : ', sem sessões'}`}
              aria-pressed={estaSelecionado}
              className={`relative flex aspect-square flex-col items-center justify-between rounded-2xl border p-1 text-xs font-bold transition-all ${
                estaSelecionado ? 'z-10 scale-[1.03] border-psi-vibrant bg-psi-vibrant text-white shadow-md' :
                eHoje ? 'border-psi-vibrant/60 bg-psi-vibrant/10 text-psi-darkest ring-1 ring-psi-vibrant/30' :
                totalSessoes > 0 ? 'border-emerald-200 bg-emerald-50 text-emerald-900 hover:border-emerald-400' :
                'border-line bg-white text-slate-600 hover:border-psi-vibrant hover:bg-psi-vibrant/5'
              }`}
            >
              <span className="font-black">{Number(data.slice(8, 10))}</span>
              {totalSessoes > 0 && (
                <span className={`rounded-full px-1.5 text-[9px] font-black ${estaSelecionado ? 'bg-white text-psi-vibrant' : 'bg-emerald-600 text-white'}`}>
                  {totalSessoes}
                </span>
              )}
            </button>
          );
        })}
      </div>
      <div className="flex flex-wrap gap-x-4 gap-y-2 border-t border-line pt-3 text-[10px] font-bold text-muted">
        <span className="flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-full bg-emerald-500" /> Com sessão</span>
        <span className="flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-full border border-line bg-white" /> Sem sessão</span>
      </div>
    </>
  );
}
