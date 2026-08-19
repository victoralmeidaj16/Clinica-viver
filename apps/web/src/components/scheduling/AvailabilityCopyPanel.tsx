'use client';

import { Check, Copy, X } from 'lucide-react';
import { DIAS, DIAS_CURTOS } from './availabilityEditorModel';

interface Props {
  origem: number;
  selecionados: readonly number[];
  onAlternar: (dia: number) => void;
  onCancelar: () => void;
  onAplicar: () => void;
}

export function AvailabilityCopyPanel({ origem, selecionados, onAlternar, onCancelar, onAplicar }: Props) {
  return (
    <div className="rounded-2xl border border-psi-vibrant/30 bg-psi-soft/40 p-4 sm:p-5">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="flex items-center gap-2 text-sm font-extrabold text-ink"><Copy className="h-4 w-4 text-psi-deep" /> Copiar horários de {DIAS[origem]}</p>
          <p className="mt-1 text-xs text-muted">Escolha os dias que receberão os mesmos períodos, duração e modalidade.</p>
        </div>
        <button type="button" onClick={onCancelar} aria-label="Fechar" className="rounded-lg p-1.5 text-muted hover:bg-white"><X className="h-4 w-4" /></button>
      </div>
      <div className="mt-4 flex flex-wrap gap-2">
        {DIAS_CURTOS.map((dia, indice) => indice !== origem && (
          <button key={dia} type="button" onClick={() => onAlternar(indice)} className={`flex h-10 min-w-12 items-center justify-center gap-1 rounded-xl border px-3 text-xs font-bold transition ${
            selecionados.includes(indice) ? 'border-psi-deep bg-psi-deep text-white' : 'border-psi-soft bg-white text-muted hover:border-psi-vibrant'
          }`}>
            {selecionados.includes(indice) && <Check className="h-3.5 w-3.5" />}{dia}
          </button>
        ))}
      </div>
      <div className="mt-4 flex justify-end gap-2">
        <button type="button" onClick={onCancelar} className="btn-ghost px-3 py-2 text-xs">Cancelar</button>
        <button type="button" onClick={onAplicar} disabled={selecionados.length === 0} className="btn-primary px-4 py-2 text-xs">Copiar para {selecionados.length} {selecionados.length === 1 ? 'dia' : 'dias'}</button>
      </div>
    </div>
  );
}
