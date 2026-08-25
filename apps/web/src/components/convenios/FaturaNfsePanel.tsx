'use client';

import { useState } from 'react';
import { Banknote, Check, Copy, ExternalLink, FileCheck2, Loader2 } from 'lucide-react';
import { applicationRequest, commandHeaders } from '@/lib/applicationApi';
import type { FaturaConvenioView } from './types';

const money = (cents: number) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(cents / 100);
const statusLabel = { aberta: 'Aberta', boleto_gerado: 'Boleto gerado', paga: 'Paga', cancelada: 'Cancelada' } as const;

interface FiscalData {
  preview: { camposPendentes: string[]; integracaoConfigurada: boolean; statusFatura: string };
  emission: { status: string; numeroNfse?: string; danfseDisponivel?: boolean; xmlNfseDisponivel?: boolean };
}

export function FaturaNfsePanel({ convenioId, fatura, onRefresh }: { convenioId: string; fatura: FaturaConvenioView; onRefresh: () => Promise<void> }) {
  const [working, setWorking] = useState<'boleto' | 'nfse'>();
  const [fiscal, setFiscal] = useState<FiscalData>();
  const [error, setError] = useState('');
  const [copied, setCopied] = useState(false);
  const [cancelling, setCancelling] = useState(false);
  const [cancelReason, setCancelReason] = useState('');
  const base = `/convenios/${encodeURIComponent(convenioId)}/faturas/${encodeURIComponent(fatura.id)}`;

  const boleto = async () => {
    setWorking('boleto'); setError('');
    try { await applicationRequest(`${base}/boleto`, { method: 'POST', headers: commandHeaders() }); await onRefresh(); }
    catch (cause) { setError(cause instanceof Error ? cause.message : 'Não foi possível gerar o boleto.'); }
    finally { setWorking(undefined); }
  };

  const loadFiscal = async () => {
    setError('');
    try { const data = await applicationRequest<FiscalData>(`${base}/nfse`); setFiscal(data); return data; }
    catch (cause) { setError(cause instanceof Error ? cause.message : 'Não foi possível consultar a NFS-e.'); }
  };

  const nfse = async () => {
    setWorking('nfse'); setError('');
    try {
      const data = fiscal ?? await loadFiscal();
      if (!data || data.preview.camposPendentes.length) return;
      await applicationRequest(`${base}/nfse`, { method: 'POST', headers: commandHeaders(), body: JSON.stringify({ confirmar: true }) });
      await loadFiscal(); await onRefresh();
    } catch (cause) { setError(cause instanceof Error ? cause.message : 'Não foi possível emitir a NFS-e.'); }
    finally { setWorking(undefined); }
  };

  const cancelNfse = async () => {
    if (!cancelReason.trim()) return;
    setWorking('nfse'); setError('');
    try {
      await applicationRequest(`${base}/nfse/cancelar`, {
        method: 'POST', headers: commandHeaders(),
        body: JSON.stringify({ confirmar: true, motivo: cancelReason.trim(), codigoMotivo: '1' }),
      });
      setCancelling(false); setCancelReason(''); await loadFiscal(); await onRefresh();
    } catch (cause) { setError(cause instanceof Error ? cause.message : 'Não foi possível cancelar a NFS-e.'); }
    finally { setWorking(undefined); }
  };

  return (
    <article className="rounded-2xl border border-psi-soft/70 bg-white p-4 shadow-sm">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div><p className="text-[10px] font-black uppercase tracking-[.16em] text-muted">Competência {fatura.competencia}</p><p className="mt-1 text-lg font-black text-ink">{money(fatura.valorCents)}</p><p className="text-xs text-muted">{fatura.totalSessoes} sessões · {statusLabel[fatura.status]}</p></div>
        <span className={`rounded-full border px-2.5 py-1 text-[10px] font-black ${fatura.status === 'paga' ? 'border-emerald-200 bg-emerald-50 text-emerald-800' : 'border-amber-200 bg-amber-50 text-amber-800'}`}>{statusLabel[fatura.status]}</span>
      </div>
      {fatura.linhaDigitavel && <div className="mt-3 flex items-center gap-2 rounded-xl bg-slate-50 p-2.5"><code className="min-w-0 flex-1 break-all text-[10px] text-ink">{fatura.linhaDigitavel}</code><button type="button" onClick={() => { void navigator.clipboard.writeText(fatura.linhaDigitavel!); setCopied(true); }} className="rounded-lg p-2 text-muted hover:bg-white hover:text-ink">{copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}</button></div>}
      {fiscal?.preview.camposPendentes.length ? <p className="mt-3 rounded-xl bg-amber-50 p-3 text-xs font-bold text-amber-800">Complete: {fiscal.preview.camposPendentes.join(', ')}.</p> : null}
      {error && <p className="mt-3 rounded-xl bg-rose-50 p-3 text-xs font-bold text-rose-700">{error}</p>}
      {cancelling && <div className="mt-3 flex flex-col gap-2 rounded-xl border border-rose-200 bg-rose-50 p-3"><label className="text-xs font-bold text-rose-900">Motivo do cancelamento<input value={cancelReason} onChange={(event) => setCancelReason(event.target.value)} className="input mt-1 bg-white text-xs" /></label><div className="flex gap-2"><button type="button" onClick={() => setCancelling(false)} className="btn-outline px-3 py-2 text-[11px]">Voltar</button><button type="button" onClick={() => void cancelNfse()} disabled={!cancelReason.trim() || Boolean(working)} className="rounded-xl bg-rose-700 px-3 py-2 text-[11px] font-black text-white disabled:opacity-50">Confirmar cancelamento</button></div></div>}
      <div className="mt-4 flex flex-wrap gap-2">
        {fatura.status === 'aberta' && <button type="button" onClick={() => void boleto()} disabled={Boolean(working)} className="btn-accent px-3 py-2 text-[11px] disabled:opacity-50">{working === 'boleto' ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Banknote className="h-3.5 w-3.5" />} Gerar boleto</button>}
        {fatura.boletoUrl && <a href={fatura.boletoUrl} target="_blank" rel="noreferrer" className="btn-outline px-3 py-2 text-[11px]"><ExternalLink className="h-3.5 w-3.5" /> Abrir boleto</a>}
        {fatura.status === 'paga' && fiscal?.emission.status !== 'issued' && <button type="button" onClick={() => void (fiscal ? nfse() : loadFiscal())} disabled={Boolean(working)} className="btn-accent px-3 py-2 text-[11px] disabled:opacity-50">{working === 'nfse' ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <FileCheck2 className="h-3.5 w-3.5" />} {fiscal ? 'Emitir NFS-e PJ' : 'Preparar NFS-e'}</button>}
        {fiscal?.emission.status === 'issued' && <><a href={`/api/application${base}/nfse/pdf`} target="_blank" className="btn-outline px-3 py-2 text-[11px]">DANFSe</a><a href={`/api/application${base}/nfse/xml`} className="btn-outline px-3 py-2 text-[11px]">XML</a><button type="button" onClick={() => setCancelling(true)} className="rounded-xl border border-rose-200 px-3 py-2 text-[11px] font-black text-rose-700">Cancelar NFS-e</button></>}
      </div>
    </article>
  );
}
