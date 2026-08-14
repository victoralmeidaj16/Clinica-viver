'use client';

import { useMemo, useState } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';

const DIAS_SEMANA = ['D', 'S', 'T', 'Q', 'Q', 'S', 'S'];

interface Props {
  /** `YYYY-MM-DD` que têm ao menos um horário livre. */
  diasDisponiveis: readonly string[];
  diaSelecionado?: string;
  onSelecionar: (dia: string) => void;
}

/** `YYYY-MM` do primeiro dia com vaga, ou o mês corrente se não houver nenhum. */
function mesInicial(dias: readonly string[]): string {
  return dias[0]?.slice(0, 7) ?? new Date().toISOString().slice(0, 7);
}

function rotuloMes(mes: string): string {
  return new Date(`${mes}-01T12:00:00Z`).toLocaleDateString('pt-BR', {
    month: 'long',
    year: 'numeric',
    timeZone: 'UTC',
  });
}

function deslocarMes(mes: string, passo: number): string {
  const [ano, numero] = mes.split('-').map(Number);
  const data = new Date(Date.UTC(ano, numero - 1 + passo, 1));
  return data.toISOString().slice(0, 7);
}

/**
 * Calendário de escolha do dia.
 *
 * Só o que tem vaga é clicável, e a navegação de mês existe porque a grade
 * recorrente costuma abrir horários bem além da semana atual. Mostrar dias
 * cheios como se fossem clicáveis daria ao paciente um caminho que termina em
 * uma lista de horários vazia.
 */
export function PublicBookingCalendar({ diasDisponiveis, diaSelecionado, onSelecionar }: Props) {
  const [mes, setMes] = useState(() => mesInicial(diasDisponiveis));
  const disponiveis = useMemo(() => new Set(diasDisponiveis), [diasDisponiveis]);

  const celulas = useMemo(() => {
    const [ano, numero] = mes.split('-').map(Number);
    const primeiro = new Date(Date.UTC(ano, numero - 1, 1));
    const total = new Date(Date.UTC(ano, numero, 0)).getUTCDate();
    const vazios = Array.from({ length: primeiro.getUTCDay() }, () => null);
    const dias = Array.from({ length: total }, (_, indice) =>
      new Date(Date.UTC(ano, numero - 1, indice + 1)).toISOString().slice(0, 10)
    );
    return [...vazios, ...dias];
  }, [mes]);

  const primeiroMes = mesInicial(diasDisponiveis);
  const ultimoMes = diasDisponiveis[diasDisponiveis.length - 1]?.slice(0, 7) ?? primeiroMes;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <button
          type="button"
          disabled={mes <= primeiroMes}
          onClick={() => setMes(deslocarMes(mes, -1))}
          aria-label="Mês anterior"
          className="rounded-xl border border-slate-700 p-2 text-slate-300 disabled:opacity-30"
        >
          <ChevronLeft className="w-4 h-4" />
        </button>
        <p className="text-sm font-black text-white capitalize">{rotuloMes(mes)}</p>
        <button
          type="button"
          disabled={mes >= ultimoMes}
          onClick={() => setMes(deslocarMes(mes, 1))}
          aria-label="Próximo mês"
          className="rounded-xl border border-slate-700 p-2 text-slate-300 disabled:opacity-30"
        >
          <ChevronRight className="w-4 h-4" />
        </button>
      </div>

      <div className="grid grid-cols-7 gap-1 text-center">
        {DIAS_SEMANA.map((letra, indice) => (
          <span key={`${letra}-${indice}`} className="text-[10px] font-bold text-slate-500 py-1">
            {letra}
          </span>
        ))}
        {celulas.map((dia, indice) => {
          if (!dia) return <span key={`vazio-${indice}`} />;
          const livre = disponiveis.has(dia);
          const ativo = dia === diaSelecionado;
          return (
            <button
              key={dia}
              type="button"
              disabled={!livre}
              onClick={() => onSelecionar(dia)}
              aria-pressed={ativo}
              className={`aspect-square rounded-xl text-xs font-bold transition-colors ${
                ativo
                  ? 'bg-emerald-500 text-slate-950'
                  : livre
                    ? 'bg-slate-800 text-emerald-300 hover:bg-slate-700 border border-emerald-500/30'
                    : 'text-slate-600'
              }`}
            >
              {Number(dia.slice(8, 10))}
            </button>
          );
        })}
      </div>

      <p className="text-[11px] text-slate-500 text-center">
        Apenas os dias destacados têm horários livres.
      </p>
    </div>
  );
}
