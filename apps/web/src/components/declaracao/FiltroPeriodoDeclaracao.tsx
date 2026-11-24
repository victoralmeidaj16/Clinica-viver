'use client';

interface Props {
  inicio: string;
  fim: string;
  temFiltroAplicado: boolean;
  desabilitado: boolean;
  onInicioChange: (valor: string) => void;
  onFimChange: (valor: string) => void;
  onAplicar: () => void;
  onLimpar: () => void;
}

/** Filtro opcional de competência/período para apurar somente as sessões do recorte escolhido. */
export function FiltroPeriodoDeclaracao({
  inicio,
  fim,
  temFiltroAplicado,
  desabilitado,
  onInicioChange,
  onFimChange,
  onAplicar,
  onLimpar,
}: Props) {
  const periodoInvalido = Boolean(inicio && fim && inicio > fim);

  return (
    <div className="flex flex-wrap items-end gap-3 rounded-xl border border-slate-200 bg-slate-50/70 p-3">
      <label className="text-xs font-medium text-slate-700">
        Período — de
        <input
          type="date"
          value={inicio}
          disabled={desabilitado}
          onChange={(evento) => onInicioChange(evento.target.value)}
          className="mt-1 block rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-purple-600 disabled:bg-slate-100"
        />
      </label>
      <label className="text-xs font-medium text-slate-700">
        Até
        <input
          type="date"
          value={fim}
          disabled={desabilitado}
          onChange={(evento) => onFimChange(evento.target.value)}
          className="mt-1 block rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-purple-600 disabled:bg-slate-100"
        />
      </label>
      <button
        type="button"
        disabled={desabilitado || periodoInvalido || (!inicio && !fim)}
        onClick={onAplicar}
        className="rounded-lg bg-purple-700 px-3.5 py-2 text-xs font-semibold text-white transition hover:bg-purple-800 disabled:opacity-50"
      >
        Filtrar período
      </button>
      {(temFiltroAplicado || inicio || fim) && (
        <button
          type="button"
          disabled={desabilitado}
          onClick={onLimpar}
          className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700 transition hover:bg-slate-100 disabled:opacity-50"
        >
          Limpar período
        </button>
      )}
      {periodoInvalido && (
        <p className="w-full text-[11px] font-medium text-red-700">
          A data inicial não pode ser posterior à data final.
        </p>
      )}
    </div>
  );
}

