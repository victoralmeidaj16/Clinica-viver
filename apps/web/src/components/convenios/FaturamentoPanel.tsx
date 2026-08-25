'use client';

import { useState } from 'react';
import { Download, FilePlus2, Loader2 } from 'lucide-react';
import { applicationRequest, commandHeaders } from '@/lib/applicationApi';
import type { ConvenioDetailView } from './types';
import { FaturaNfsePanel } from './FaturaNfsePanel';

const localDate = (date: Date) => `${date.getFullYear()}-${`${date.getMonth() + 1}`.padStart(2, '0')}-${`${date.getDate()}`.padStart(2, '0')}`;

export function FaturamentoPanel({ detail, onRefresh }: { detail: ConvenioDetailView; onRefresh: (period?: { inicio: string; fim: string }) => Promise<void> }) {
  const today = new Date();
  const [inicio, setInicio] = useState(() => localDate(new Date(today.getFullYear(), today.getMonth(), 1)));
  const [fim, setFim] = useState(() => localDate(today));
  const [closing, setClosing] = useState(false);
  const [error, setError] = useState('');
  const competencia = inicio.slice(0, 7);
  const close = async () => {
    setClosing(true); setError('');
    try {
      await applicationRequest(`/convenios/${encodeURIComponent(detail.convenio.id)}/faturas`, {
        method: 'POST', headers: commandHeaders(),
        body: JSON.stringify({ competencia, periodoInicio: inicio, periodoFim: fim }),
      });
      await onRefresh({ inicio, fim });
    } catch (cause) { setError(cause instanceof Error ? cause.message : 'Não foi possível fechar a fatura.'); }
    finally { setClosing(false); }
  };
  const report = (format: 'csv' | 'pdf') => `/api/application/convenios/${encodeURIComponent(detail.convenio.id)}/relatorio?inicio=${inicio}&fim=${fim}&format=${format}`;
  return (
    <section className="space-y-4 border-t border-psi-soft/70 pt-5">
      <div><p className="text-[10px] font-black uppercase tracking-[.2em] text-emerald-700">Custeado pela empresa</p><h3 className="mt-1 text-base font-black text-ink">Faturamento do período</h3></div>
      <div className="grid gap-2 sm:grid-cols-2"><label className="text-xs font-bold text-ink">Início<input type="date" value={inicio} onChange={(e) => setInicio(e.target.value)} className="input mt-1 text-xs" /></label><label className="text-xs font-bold text-ink">Fim<input type="date" value={fim} onChange={(e) => setFim(e.target.value)} className="input mt-1 text-xs" /></label></div>
      <div className="flex flex-wrap gap-2"><button type="button" onClick={() => void onRefresh({ inicio, fim })} className="btn-outline px-3 py-2 text-[11px]">Aplicar período</button><button type="button" onClick={() => void close()} disabled={closing} className="btn-accent px-3 py-2 text-[11px] disabled:opacity-50">{closing ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <FilePlus2 className="h-3.5 w-3.5" />} Fechar fatura</button><a href={report('csv')} className="btn-outline px-3 py-2 text-[11px]"><Download className="h-3.5 w-3.5" /> CSV</a><a href={report('pdf')} target="_blank" className="btn-outline px-3 py-2 text-[11px]"><Download className="h-3.5 w-3.5" /> PDF</a></div>
      {error && <p className="rounded-xl bg-rose-50 p-3 text-xs font-bold text-rose-700">{error}</p>}
      <div className="space-y-3"><h4 className="text-xs font-black uppercase tracking-wider text-muted">Histórico de faturas</h4>{detail.faturas.map((item) => <FaturaNfsePanel key={item.id} convenioId={detail.convenio.id} fatura={item} onRefresh={() => onRefresh({ inicio, fim })} />)}{detail.faturas.length === 0 && <p className="rounded-2xl border border-dashed border-psi-soft p-5 text-center text-xs text-muted">Nenhuma fatura fechada.</p>}</div>
    </section>
  );
}
