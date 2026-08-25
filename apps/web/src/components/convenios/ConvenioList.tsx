'use client';

import { Building2, ChevronRight, Search, UsersRound } from 'lucide-react';
import type { ConvenioView } from './types';

const money = (cents: number) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(cents / 100);

export function ConvenioList({ items, selectedId, search, fundedOnly, onSearch, onFundedOnly, onSelect }: {
  items: readonly ConvenioView[]; selectedId?: string; search: string; fundedOnly: boolean;
  onSearch: (value: string) => void; onFundedOnly: (value: boolean) => void; onSelect: (id: string) => void;
}) {
  return (
    <section className="overflow-hidden rounded-[26px] border border-psi-soft/70 bg-surface shadow-card">
      <div className="border-b border-psi-soft/70 p-4 sm:p-5">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
          <label className="relative flex-1">
            <Search className="absolute left-3.5 top-3 h-4 w-4 text-muted" />
            <input value={search} onChange={(event) => onSearch(event.target.value)} placeholder="Buscar empresa" className="w-full rounded-xl border border-psi-soft bg-white py-2.5 pl-10 pr-3 text-xs font-semibold text-ink outline-none focus:border-psi-vibrant focus:ring-2 focus:ring-psi-vibrant/15" />
          </label>
          <button type="button" onClick={() => onFundedOnly(!fundedOnly)} aria-pressed={fundedOnly} className={`rounded-xl border px-4 py-2.5 text-xs font-black transition ${fundedOnly ? 'border-emerald-600 bg-emerald-600 text-white' : 'border-psi-soft bg-white text-muted hover:text-ink'}`}>
            Custeado pela empresa
          </button>
        </div>
        <p className="mt-3 text-[10px] font-black uppercase tracking-[.18em] text-muted">{items.length} registros encontrados</p>
      </div>
      <div className="max-h-[68vh] divide-y divide-psi-soft/60 overflow-y-auto">
        {items.map((item) => (
          <button key={item.id} type="button" onClick={() => onSelect(item.id)} className={`group grid w-full grid-cols-[auto_1fr_auto] items-center gap-3 px-4 py-4 text-left transition sm:px-5 ${selectedId === item.id ? 'bg-psi-soft/55' : 'hover:bg-psi-soft/25'}`}>
            <span className={`flex h-10 w-10 items-center justify-center rounded-xl ${item.empresaPagaSessoes ? 'bg-emerald-100 text-emerald-800' : 'bg-psi-soft text-psi-deep'}`}><Building2 className="h-4 w-4" /></span>
            <span className="min-w-0">
              <span className="block truncate text-sm font-black text-ink">{item.nome}</span>
              <span className="mt-1 flex flex-wrap items-center gap-2 text-[10px] font-bold text-muted">
                <span className="flex items-center gap-1"><UsersRound className="h-3 w-3" /> {item.pacientes} pacientes</span>
                {item.empresaPagaSessoes && <span className="text-emerald-700">{money(item.valorProvisionadoCents)} a faturar</span>}
              </span>
            </span>
            <ChevronRight className="h-4 w-4 text-muted transition group-hover:translate-x-0.5 group-hover:text-ink" />
          </button>
        ))}
        {items.length === 0 && <p className="px-6 py-16 text-center text-sm text-muted">Nenhum convênio corresponde aos filtros.</p>}
      </div>
    </section>
  );
}
