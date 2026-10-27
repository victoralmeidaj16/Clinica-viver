'use client';

import { useState } from 'react';
import { Check, Loader2, X } from 'lucide-react';
import type { RescheduleRequestSummary } from '@/server/scheduling/rescheduleRequestRepository';

const FORMAT = new Intl.DateTimeFormat('pt-BR', {
  dateStyle: 'short', timeStyle: 'short', timeZone: 'America/Sao_Paulo',
});

export function RescheduleRequestCard({ request, patientName, onDecision }: {
  request: RescheduleRequestSummary;
  patientName: string;
  onDecision: (requestId: string, decision: 'accept' | 'reject') => Promise<void>;
}) {
  const [working, setWorking] = useState<'accept' | 'reject'>();
  const [error, setError] = useState<string>();
  const decide = async (decision: 'accept' | 'reject') => {
    if (working) return;
    setWorking(decision); setError(undefined);
    try { await onDecision(request.id, decision); }
    catch (cause) { setError(cause instanceof Error ? cause.message : 'Não foi possível responder à solicitação.'); }
    finally { setWorking(undefined); }
  };
  return (
    <section className="rounded-2xl border border-amber-300 bg-amber-50 p-4" aria-label="Reagendamento solicitado">
      <p className="text-xs font-black uppercase tracking-wide text-amber-900">Reagendamento solicitado</p>
      <p className="mt-1 text-xs font-semibold text-amber-950">{patientName}</p>
      <div className="mt-3 grid gap-2 text-xs text-amber-950 sm:grid-cols-2">
        <p><span className="font-bold">Horário atual:</span><br />{FORMAT.format(new Date(request.currentStartsAt))}</p>
        <p><span className="font-bold">Horário solicitado:</span><br />{FORMAT.format(new Date(request.requestedStartsAt))} · {request.requestedModality === 'presencial' ? 'Presencial' : request.requestedModality === 'telefone' ? 'Telefone' : 'Online'}</p>
      </div>
      {error && <p role="alert" className="mt-3 text-xs font-bold text-rose-700">{error}</p>}
      <div className="mt-3 flex gap-2">
        <button type="button" disabled={Boolean(working)} onClick={() => void decide('accept')} className="inline-flex items-center gap-1.5 rounded-xl bg-emerald-600 px-3 py-2 text-xs font-extrabold text-white disabled:opacity-50">
          {working === 'accept' ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Check className="h-3.5 w-3.5" />} Aceitar
        </button>
        <button type="button" disabled={Boolean(working)} onClick={() => void decide('reject')} className="inline-flex items-center gap-1.5 rounded-xl border border-rose-300 bg-white px-3 py-2 text-xs font-extrabold text-rose-700 disabled:opacity-50">
          {working === 'reject' ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <X className="h-3.5 w-3.5" />} Recusar
        </button>
      </div>
    </section>
  );
}
