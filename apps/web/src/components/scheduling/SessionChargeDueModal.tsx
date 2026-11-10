'use client';

import { useState, type FormEvent } from 'react';
import { applicationRequest } from '@/lib/applicationApi';
import { ChargeDueFields, chargeDueFieldValues, futureChargeDueIso } from './ChargeDueFields';
import type { SessionEditableData } from './editSessionModel';

export function SessionChargeDueModal({ session, onClose, onSaved }: {
  session: SessionEditableData; onClose: () => void; onSaved: () => void | Promise<void>;
}) {
  const [initial] = useState(() => chargeDueFieldValues(session.vencimentoCobrancaEm ?? session.inicio));
  const [date, setDate] = useState(initial.date);
  const [time, setTime] = useState(initial.time);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  async function submit(event: FormEvent) {
    event.preventDefault();
    setSaving(true); setError('');
    try {
      const dueAt = futureChargeDueIso(date, time);
      await applicationRequest(`/gestao/agenda/${encodeURIComponent(session.id)}`, {
        method: 'PATCH', body: JSON.stringify({ action: 'update_charge_due', dueAt }),
      });
      await onSaved();
      onClose();
    } catch (cause) { setError(cause instanceof Error ? cause.message : 'Não foi possível alterar o vencimento.'); }
    finally { setSaving(false); }
  }

  return <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-4 backdrop-blur-sm">
    <form onSubmit={submit} role="dialog" aria-modal="true" aria-labelledby="titulo-vencimento"
      className="w-full max-w-md space-y-4 rounded-3xl border border-line bg-surface p-6 shadow-2xl">
      <div><h2 id="titulo-vencimento" className="text-lg font-black text-ink">Editar vencimento</h2>
        <p className="mt-1 text-sm text-muted">{session.pacienteNome}</p></div>
      <p className="text-xs text-muted">Altere o prazo de pagamento desta sessão. Horários no fuso de Brasília.</p>
      <ChargeDueFields date={date} time={time} disabled={saving} onDateChange={setDate} onTimeChange={setTime} />
      {error && <p role="alert" className="text-xs font-semibold text-rose-700">{error}</p>}
      <div className="flex justify-end gap-2 border-t border-line pt-4">
        <button type="button" disabled={saving} onClick={onClose} className="btn-outline text-xs">Cancelar</button>
        <button type="submit" disabled={saving} className="btn-accent text-xs">{saving ? 'Salvando…' : 'Salvar vencimento'}</button>
      </div>
    </form>
  </div>;
}
