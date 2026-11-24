'use client';

import { ClipboardList, X } from 'lucide-react';
import type { PatientDirectoryEntry } from '@/server/application/patientDirectory';
import { PreferenciasResumo } from './PreferenciasResumo';
import PatientBondForm from './PatientBondForm';

/**
 * O pedido que trouxe o paciente, com a origem das preferências (4.04), e o
 * responsável financeiro e participantes do vínculo (6.03 e 6.04).
 */
export default function PatientRequestModal({ patient, onClose, onSaved }: {
  patient: PatientDirectoryEntry | null;
  onClose: () => void;
  onSaved: () => void | Promise<void>;
}) {
  if (!patient) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-slate-950/70 backdrop-blur-sm sm:items-center sm:p-4" role="presentation"
      onMouseDown={(event) => { if (event.currentTarget === event.target) onClose(); }}>
      <section role="dialog" aria-modal="true" aria-labelledby="pedido-titulo"
        className="max-h-[94dvh] w-full max-w-2xl space-y-4 overflow-y-auto rounded-t-3xl border border-line bg-white p-5 shadow-2xl sm:rounded-3xl sm:p-6">
        <div className="flex items-start justify-between gap-3">
          <div className="flex gap-3">
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-primary/10 text-primary"><ClipboardList className="h-5 w-5" /></div>
            <div>
              <h2 id="pedido-titulo" className="text-lg font-black text-ink">Pedido e responsável</h2>
              <p className="text-xs text-muted">Paciente: <strong>{patient.displayName}</strong></p>
            </div>
          </div>
          <button type="button" aria-label="Fechar" onClick={onClose} className="flex h-11 w-11 items-center justify-center rounded-xl text-muted hover:bg-slate-100"><X className="h-5 w-5" /></button>
        </div>

        {patient.preferenciasAtuais ? (
          <div className="space-y-2">
            <h3 className="text-xs font-black uppercase tracking-wider text-ink">Preferências do pedido</h3>
            <PreferenciasResumo
              originais={patient.preferenciasOriginais}
              atuais={patient.preferenciasAtuais}
              alteracoes={patient.alteracoesPreferencias}
            />
          </div>
        ) : (
          <p className="text-xs text-muted">Este paciente foi cadastrado sem pedido de encaminhamento registrado.</p>
        )}

        <PatientBondForm patientId={patient.id} onSaved={onSaved} />
      </section>
    </div>
  );
}
