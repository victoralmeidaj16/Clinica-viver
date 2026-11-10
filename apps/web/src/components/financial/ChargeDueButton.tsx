'use client';

import { useRef, useState } from 'react';
import { applicationRequest } from '@/lib/applicationApi';
import { isFutureChargeDueAt } from '@/lib/chargeDue';
import { clinicDateTimeToIso, todayAtClinic } from '@/lib/manualAppointment';

interface Props {
  chargeId: string;
  patientName: string;
  dueAt: string;
  onSaved: () => void;
}

/** Data e hora do vencimento no fuso da clínica, no formato dos campos do formulário. */
export function chargeDueFields(iso: string): { date: string; time: string } {
  const parts = Object.fromEntries(new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Sao_Paulo', year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', hourCycle: 'h23',
  }).formatToParts(new Date(iso)).map((part) => [part.type, part.value]));
  return { date: `${parts.year}-${parts.month}-${parts.day}`, time: `${parts.hour}:${parts.minute}` };
}

export function ChargeDueButton({ chargeId, patientName, dueAt, onSaved }: Props) {
  const dialog = useRef<HTMLDialogElement>(null);
  const [date, setDate] = useState('');
  const [time, setTime] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  function open() {
    const current = chargeDueFields(dueAt);
    setDate(current.date); setTime(current.time); setError('');
    dialog.current?.showModal();
  }

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    if (busy) return;
    setBusy(true); setError('');
    try {
      const next = clinicDateTimeToIso(date, time);
      if (!isFutureChargeDueAt(next)) throw new Error('O vencimento deve estar no futuro.');
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
        <div className="grid grid-cols-2 gap-3">
          <label className="block text-sm font-semibold">Data
            <input required type="date" min={todayAtClinic()} value={date} disabled={busy}
              onChange={(event) => setDate(event.target.value)} className={field} />
          </label>
          <label className="block text-sm font-semibold">Horário
            <input required type="time" value={time} disabled={busy}
              onChange={(event) => setTime(event.target.value)} className={field} />
          </label>
        </div>
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
