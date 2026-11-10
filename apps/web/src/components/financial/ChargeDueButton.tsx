'use client';

import { useRef, useState } from 'react';
import { applicationRequest } from '@/lib/applicationApi';
import { ChargeDueFields, chargeDueFieldValues, futureChargeDueIso } from '@/components/scheduling/ChargeDueFields';

interface Props {
  chargeId: string;
  patientName: string;
  dueAt: string;
  onSaved: () => void;
}

export function ChargeDueButton({ chargeId, patientName, dueAt, onSaved }: Props) {
  const dialog = useRef<HTMLDialogElement>(null);
  const [date, setDate] = useState('');
  const [time, setTime] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  function open() {
    const current = chargeDueFieldValues(dueAt);
    setDate(current.date); setTime(current.time); setError('');
    dialog.current?.showModal();
  }

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    if (busy) return;
    setBusy(true); setError('');
    try {
      const next = futureChargeDueIso(date, time);
      await applicationRequest(`/financial/clinica/${encodeURIComponent(chargeId)}/due`, {
        method: 'PATCH', body: JSON.stringify({ dueAt: next }),
      });
      dialog.current?.close();
      onSaved();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Não foi possível alterar o vencimento.');
    } finally { setBusy(false); }
  }

  const field = 'mt-1 w-full rounded-xl border border-line bg-white px-3 py-2 text-sm';
  return <>
    <button type="button" className="mt-1 block text-left text-[11px] font-bold text-psi-deep underline"
      aria-label={`Editar vencimento de ${patientName}`} onClick={open}>
      Editar vencimento
    </button>
    <dialog ref={dialog} aria-labelledby={`due-title-${chargeId}`}
      onCancel={(event) => { if (busy) event.preventDefault(); }}
      className="m-auto w-[min(92vw,28rem)] rounded-2xl border border-line bg-white p-6 text-ink shadow-xl backdrop:bg-black/40">
      <form onSubmit={(event) => void submit(event)} className="space-y-4">
        <h2 id={`due-title-${chargeId}`} className="text-lg font-extrabold">Editar vencimento</h2>
        <p className="text-sm">{patientName}</p>
        <p className="text-sm text-muted">Defina o novo prazo de pagamento desta sessão, no horário de Brasília.
          Um PIX ou boleto já emitido para esta sessão é cancelado; o próximo é gerado com o novo prazo.</p>
        <ChargeDueFields date={date} time={time} disabled={busy} onDateChange={setDate} onTimeChange={setTime}
          labelClassName="block text-sm font-semibold" inputClassName={field} />
        {error && <p role="alert" className="text-sm text-red-700">{error}</p>}
        <div className="flex justify-end gap-3">
          <button type="button" disabled={busy} onClick={() => dialog.current?.close()} className="rounded-xl border border-line px-4 py-2">Cancelar</button>
          <button type="submit" disabled={busy} className="rounded-xl bg-psi-deep px-4 py-2 font-bold text-white disabled:opacity-50">
            {busy ? 'Salvando…' : 'Salvar vencimento'}
          </button>
        </div>
      </form>
    </dialog>
  </>;
}
