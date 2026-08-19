'use client';

import { CalendarOff } from 'lucide-react';

interface Props {
  quantidade: number;
  motivo: string;
  executando: boolean;
  onMotivo: (valor: string) => void;
  onBloquear: () => void;
}

export function CalendarBatchPanel({ quantidade, motivo, executando, onMotivo, onBloquear }: Props) {
  return (
    <div className="space-y-4">
      <div>
        <span className="chip-accent text-[10px]">Ação em lote</span>
        <h4 className="mt-1 text-base font-black text-ink">Bloquear {quantidade} {quantidade === 1 ? 'dia selecionado' : 'dias selecionados'}</h4>
        <p className="text-xs text-muted">Dias com sessões da clínica não serão bloqueados sem que elas sejam reagendadas ou canceladas.</p>
      </div>
      <div className="space-y-3 rounded-2xl border border-slate-200 bg-white p-4">
        <label className="block text-xs font-bold text-slate-700">Motivo do bloqueio
          <input value={motivo} onChange={(evento) => onMotivo(evento.target.value)} placeholder="Férias, congresso…" className="input mt-1 py-2 text-xs" />
        </label>
        <button type="button" disabled={executando} onClick={onBloquear} className="flex w-full items-center justify-center gap-2 rounded-2xl bg-rose-600 py-3 text-xs font-black text-white shadow-md transition hover:bg-rose-500 disabled:opacity-50">
          <CalendarOff className="h-4 w-4" /> {executando ? 'Processando…' : `Bloquear ${quantidade} ${quantidade === 1 ? 'dia' : 'dias'}`}
        </button>
      </div>
    </div>
  );
}
