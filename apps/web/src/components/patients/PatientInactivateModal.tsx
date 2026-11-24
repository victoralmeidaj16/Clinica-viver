'use client';

import { useRef, useState } from 'react';
import { PowerOff, X } from 'lucide-react';
import { applicationRequest, commandHeaders } from '@/lib/applicationApi';
import { MOTIVO_INATIVACAO_MINIMO } from '@/lib/inativacaoVinculo';
import type { PatientDirectoryEntry } from '@/server/application/patientDirectory';

/**
 * Inativação do vínculo pelo psicólogo responsável (especificação final,
 * 6.05). Diferente da desistência: a vaga volta na hora, sem novo
 * encaminhamento; a Gestão consulta motivo, data e autor.
 */
export default function PatientInactivateModal({ patient, onClose, onInactivated }: {
  patient: PatientDirectoryEntry | null;
  onClose: () => void;
  onInactivated: () => void | Promise<void>;
}) {
  const [motivo, setMotivo] = useState('');
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState<string>();
  const comando = useRef<ReturnType<typeof commandHeaders> | null>(null);

  if (!patient) return null;

  const fechar = () => { if (!salvando) { comando.current = null; setMotivo(''); setErro(undefined); onClose(); } };

  const enviar = async (event: React.FormEvent) => {
    event.preventDefault();
    setSalvando(true);
    setErro(undefined);
    try {
      comando.current ??= commandHeaders();
      await applicationRequest('/patients/inativacao', {
        method: 'POST',
        headers: comando.current,
        body: JSON.stringify({ patientId: patient.id, motivo }),
      });
      comando.current = null;
      setMotivo('');
      await onInactivated();
      onClose();
    } catch (causa) {
      setErro(causa instanceof Error ? causa.message : 'Não foi possível inativar o vínculo.');
    } finally {
      setSalvando(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-slate-950/70 backdrop-blur-sm sm:items-center sm:p-4" role="presentation"
      onMouseDown={(event) => { if (event.currentTarget === event.target) fechar(); }}>
      <form role="dialog" aria-modal="true" aria-labelledby="inativar-titulo" onSubmit={enviar}
        className="w-full max-w-lg space-y-4 rounded-t-3xl border border-line bg-white p-5 shadow-2xl sm:rounded-3xl sm:p-6">
        <div className="flex items-start justify-between gap-3">
          <div className="flex gap-3">
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-slate-700 text-white"><PowerOff className="h-5 w-5" /></div>
            <div>
              <h2 id="inativar-titulo" className="text-lg font-black text-ink">Inativar vínculo</h2>
              <p className="text-xs text-muted">Paciente: <strong>{patient.displayName}</strong></p>
            </div>
          </div>
          <button type="button" aria-label="Fechar" onClick={fechar} className="flex h-11 w-11 items-center justify-center rounded-xl text-muted hover:bg-slate-100"><X className="h-5 w-5" /></button>
        </div>
        <p className="rounded-xl border border-slate-200 bg-slate-50 p-3 text-xs text-slate-700">
          O paciente deixa de contar como ativo e a vaga volta ao rodízio imediatamente. Se ele desistiu e precisa de outro profissional, use “Registrar desistência”.
        </p>
        <label className="block text-xs font-bold text-ink">
          Motivo da inativação *
          <textarea value={motivo} onChange={(event) => setMotivo(event.target.value)} rows={3} required
            className="mt-1 block w-full rounded-xl border border-line bg-slate-50 px-3 py-2 text-xs font-normal text-ink focus:border-psi-vibrant focus:outline-none" />
        </label>
        {erro && <p className="rounded-xl border border-rose-200 bg-rose-50 p-3 text-xs font-semibold text-rose-700">{erro}</p>}
        <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <button type="button" onClick={fechar} disabled={salvando} className="btn-ghost min-h-11 justify-center">Cancelar</button>
          <button type="submit" disabled={salvando || motivo.trim().length < MOTIVO_INATIVACAO_MINIMO} className="btn-primary min-h-11 justify-center disabled:opacity-50">
            {salvando ? 'Salvando…' : 'Inativar vínculo'}
          </button>
        </div>
      </form>
    </div>
  );
}
