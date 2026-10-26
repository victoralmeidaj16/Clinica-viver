'use client';

import { useRef, useState } from 'react';
import { applicationRequest, commandHeaders } from '@/lib/applicationApi';

interface Props {
  chargeId: string;
  patientName: string;
  outstandingCents: number;
  onSaved: () => void;
}

export function ManualPaymentButton({ chargeId, patientName, outstandingCents, onSaved }: Props) {
  const dialog = useRef<HTMLDialogElement>(null);
  const submitting = useRef(false);
  const request = useRef<{ body: string; headers: ReturnType<typeof commandHeaders> } | null>(null);
  const [amount, setAmount] = useState((outstandingCents / 100).toFixed(2));
  const [date, setDate] = useState(() => new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Sao_Paulo' }).format(new Date()));
  const [method, setMethod] = useState('pix');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    if (submitting.current) return;
    const normalized = amount.replace(',', '.');
    if (!/^\d+(\.\d{1,2})?$/.test(normalized)) {
      setError('Informe o valor com até duas casas decimais.');
      return;
    }
    const amountCents = Math.round(Number(normalized) * 100);
    if (amountCents <= 0 || amountCents > outstandingCents) {
      setError('Informe um valor maior que zero e até o saldo em aberto.');
      return;
    }
    const body = JSON.stringify({ amountCents, receivedAt: date, method, expectedOutstandingCents: outstandingCents });
    // Uma falha de rede pode acontecer depois do commit; repetir mantém a chave.
    if (!request.current || request.current.body !== body) request.current = { body, headers: commandHeaders() };
    submitting.current = true;
    setBusy(true);
    setError('');
    try {
      await applicationRequest(`/financial/clinica/${encodeURIComponent(chargeId)}/payments`, {
        method: 'POST', ...request.current,
      });
      dialog.current?.close();
      onSaved();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Não foi possível registrar o pagamento.');
    } finally {
      submitting.current = false;
      setBusy(false);
    }
  }

  const field = 'mt-1 w-full rounded-xl border border-line bg-white px-3 py-2 text-sm';
  return <>
    <button type="button" className="mt-2 block text-left text-[11px] font-bold text-psi-deep underline"
      onClick={() => { setAmount((outstandingCents / 100).toFixed(2)); setError(''); dialog.current?.showModal(); }}>
      Registrar pagamento manual
    </button>
    <dialog ref={dialog} aria-labelledby={`manual-title-${chargeId}`}
      onCancel={(event) => { if (busy) event.preventDefault(); }}
      className="m-auto w-[min(92vw,28rem)] rounded-2xl border border-line bg-white p-6 text-ink shadow-xl backdrop:bg-black/40">
      <form onSubmit={(event) => void submit(event)} className="space-y-4">
        <h2 id={`manual-title-${chargeId}`} className="text-lg font-extrabold">Registrar pagamento manual</h2>
        <p className="text-sm">{patientName}</p>
        <p className="text-sm text-muted">Confirme o recebimento na conta da clínica antes de registrar.
          Saldo em aberto: {(outstandingCents / 100).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}.</p>
        <label className="block text-sm font-semibold">Valor recebido (R$)
          <input required inputMode="decimal" value={amount} disabled={busy}
            onChange={(event) => setAmount(event.target.value)} className={field} />
        </label>
        <label className="block text-sm font-semibold">Data do recebimento
          <input required type="date" value={date} disabled={busy}
            onChange={(event) => setDate(event.target.value)} className={field} />
        </label>
        <label className="block text-sm font-semibold">Forma de pagamento
          <select value={method} disabled={busy} onChange={(event) => setMethod(event.target.value)} className={field}>
            <option value="pix">PIX em outra conta / recebido diretamente</option>
            <option value="bank_transfer">Transferência bancária</option>
            <option value="cash">Dinheiro</option>
            <option value="card">Cartão</option>
            <option value="other">Outro</option>
          </select>
        </label>
        {error && <p role="alert" className="text-sm text-red-700">{error}</p>}
        <div className="flex justify-end gap-3">
          <button type="button" disabled={busy} onClick={() => dialog.current?.close()} className="rounded-xl border border-line px-4 py-2">Cancelar</button>
          <button type="submit" disabled={busy} className="rounded-xl bg-psi-deep px-4 py-2 font-bold text-white disabled:opacity-50">
            {busy ? 'Registrando…' : 'Confirmar recebimento'}
          </button>
        </div>
      </form>
    </dialog>
  </>;
}
