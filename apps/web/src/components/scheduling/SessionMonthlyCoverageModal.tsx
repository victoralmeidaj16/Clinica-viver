'use client';

import { useState, type FormEvent } from 'react';
import { applicationRequest } from '@/lib/applicationApi';
import type { SessionEditableData } from './editSessionModel';

export function SessionMonthlyCoverageModal({ session, onBack, onClose, onSaved }: {
  session: SessionEditableData; onBack: () => void; onClose: () => void;
  onSaved: () => void | Promise<void>;
}) {
  const [quantity, setQuantity] = useState(session.custeioCiclo === 'mensal' ? String(session.custeioCota ?? '') : '');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [saved, setSaved] = useState(false);
  const [pending, setPending] = useState(0);

  async function submit(event: FormEvent) {
    event.preventDefault();
    const custeioCota = Number(quantity);
    if (!Number.isInteger(custeioCota) || custeioCota < 1 || custeioCota > 65535) {
      setError('Informe uma quantidade de sessões entre 1 e 65535.'); return;
    }
    setSaving(true); setError('');
    try {
      const result = await applicationRequest<{ cobrancasPendentes: number }>(`/gestao/agenda/${encodeURIComponent(session.id)}`, {
        method: 'PATCH', body: JSON.stringify({ action: 'update_monthly_coverage', custeioCota }),
      });
      setPending(result.cobrancasPendentes ?? 0);
      setSaved(true);
      await onSaved();
    } catch (cause) { setError(cause instanceof Error ? cause.message : 'Não foi possível salvar o limite mensal.'); }
    finally { setSaving(false); }
  }

  return <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-4 backdrop-blur-sm">
    <form onSubmit={submit} role="dialog" aria-modal="true" aria-labelledby="titulo-cota"
      className="max-h-[92dvh] w-full max-w-md space-y-4 overflow-y-auto rounded-3xl border border-line bg-surface p-6 shadow-2xl">
      <div><h2 id="titulo-cota" className="text-lg font-black text-ink">Sessões pagas por mês</h2>
        <p className="mt-1 text-sm font-semibold text-ink">{session.pacienteNome}</p>
        <p className="text-xs text-muted">Convênio: {session.convenioNome}</p></div>
      {session.pacoteSessoes ? <p className="rounded-xl bg-amber-50 p-3 text-xs text-amber-900">
        Este convênio define um pacote de {session.pacoteSessoes} sessões {session.pacoteSessoesCiclo === 'mensal' ? 'por mês' : 'no total'} por paciente.
        {' '}A quantidade deve ser alterada em <a href="/convenios" className="font-bold underline">Convênios</a>.
      </p> : saved ? <div role="status" className="space-y-2 rounded-xl bg-emerald-50 p-3 text-xs text-emerald-900">
        <p>Limite de {quantity} sessões por mês salvo para este paciente.</p>
        {pending > 0 && <p className="text-amber-900">{pending} cobrança(s) ainda precisam ter a transferência para a empresa concluída. Tente aplicar o limite novamente para retomar.</p>}
      </div> : <>
        <label className="block text-xs font-bold text-ink">Sessões pagas pela empresa por mês
          <input required type="number" min={1} max={65535} step={1} disabled={saving} value={quantity}
            onChange={(event) => setQuantity(event.target.value)} className="input mt-1 w-full" placeholder="Ex.: 4" /></label>
        <p className="text-xs leading-relaxed text-muted">Este limite vale para o paciente, incluindo seus atendimentos já agendados.
          A empresa cobre até essa quantidade por mês; o excedente é cobrado do paciente. A cota renova no dia 1º.</p>
        <p className="text-xs text-muted">Pagamentos já quitados são preservados. Salvar o limite não salva as demais alterações do atendimento.</p>
      </>}
      {error && <p role="alert" className="text-xs font-semibold text-rose-700">{error}</p>}
      <div className="flex justify-end gap-2 border-t border-line pt-4">
        <button type="button" disabled={saving} onClick={saved ? onClose : onBack} className="btn-outline text-xs">{saved ? 'Concluído' : 'Voltar'}</button>
        {!session.pacoteSessoes && (!saved || pending > 0) && <button type="submit" disabled={saving} className="btn-accent text-xs">
          {saving ? 'Salvando…' : saved ? 'Retomar transferência' : 'Salvar limite mensal'}</button>}
      </div>
    </form>
  </div>;
}
