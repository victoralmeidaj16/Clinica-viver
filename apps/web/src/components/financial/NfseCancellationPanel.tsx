import { useState } from 'react';
import { Ban } from 'lucide-react';

export function NfseCancellationPanel({
  cancelando,
  onCancelar,
}: {
  cancelando: boolean;
  onCancelar: (motivo: string) => void;
}) {
  const [motivo, setMotivo] = useState('');
  const [aberto, setAberto] = useState(false);
  const motivoValido = motivo.trim().length >= 15;

  return (
    <section className="rounded-2xl border border-rose-200 bg-rose-50/60 p-4 text-xs">
      {!aberto ? (
        <div className="flex flex-wrap items-center justify-between gap-2">
          <p className="font-semibold text-rose-900">Nota emitida por engano?</p>
          <button type="button" onClick={() => setAberto(true)} className="inline-flex items-center gap-1.5 rounded-xl border border-rose-300 bg-surface px-3 py-2 text-[11px] font-extrabold text-rose-700 hover:bg-rose-50">
            <Ban className="h-3.5 w-3.5" /> Cancelar NFS-e
          </button>
        </div>
      ) : (
        <div className="space-y-2">
          <label htmlFor="motivo-cancelamento" className="text-[10px] font-bold uppercase tracking-wider text-rose-900">
            Justificativa do cancelamento
          </label>
          <textarea
            id="motivo-cancelamento"
            rows={3}
            maxLength={255}
            value={motivo}
            onChange={(evento) => setMotivo(evento.target.value)}
            placeholder="Explique o que aconteceu — o tomador lê esta justificativa."
            className="w-full rounded-xl border border-rose-200 bg-surface px-3 py-2 text-sm text-ink outline-none focus:border-rose-400"
          />
          <p className="text-[11px] text-rose-900">
            O prazo de cancelamento é definido pelo município. Passado o prazo, a via é substituir a nota.
          </p>
          <div className="flex flex-wrap justify-end gap-2">
            <button type="button" onClick={() => { setAberto(false); setMotivo(''); }} className="rounded-xl px-3 py-2 text-[11px] font-bold text-muted hover:bg-slate-100">
              Voltar
            </button>
            <button
              type="button"
              onClick={() => onCancelar(motivo.trim())}
              disabled={!motivoValido || cancelando}
              title={motivoValido ? 'Registrar o evento de cancelamento' : 'Descreva o motivo com pelo menos 15 caracteres'}
              className="rounded-xl bg-rose-600 px-4 py-2 text-[11px] font-extrabold text-white disabled:cursor-not-allowed disabled:opacity-50"
            >
              {cancelando ? 'Cancelando…' : 'Confirmar cancelamento'}
            </button>
          </div>
        </div>
      )}
    </section>
  );
}
