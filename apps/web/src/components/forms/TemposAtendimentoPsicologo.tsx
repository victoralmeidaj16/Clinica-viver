import React from 'react';
import { opcoesAtendimentoDaPos } from './opcoesPsicologo';

interface Props {
  posGraduacao?: string;
  segundaPosGraduacao?: string;
  value: readonly number[];
  onChange: (value: number[]) => void;
}

export function TemposAtendimentoPsicologo({ posGraduacao, segundaPosGraduacao, value, onChange }: Props) {
  const tempos = opcoesAtendimentoDaPos(posGraduacao, segundaPosGraduacao)?.tempos ?? [];
  if (!tempos.length) return null;
  const selecionados = value.filter((tempo) => tempos.includes(tempo));
  return <fieldset className="space-y-2">
    <legend className="font-bold text-slate-700">Tempo de atendimento <span className="text-rose-500">*</span></legend>
    <div className="flex flex-wrap gap-2 text-xs">
      {tempos.map((tempo, index) => {
        const checked = selecionados.includes(tempo);
        return <label key={tempo} className={`flex cursor-pointer items-center gap-2 rounded-xl border p-2.5 ${checked ? 'border-purple-400 bg-purple-50 font-bold text-purple-950' : 'border-slate-200 bg-slate-50 text-slate-700'}`}>
          <input type="checkbox" value={tempo} checked={checked} required={!selecionados.length && index === 0}
            onChange={() => onChange(checked ? selecionados.filter((item) => item !== tempo) : [...selecionados, tempo])}
            className="h-4 w-4 accent-purple-600" />
          {tempo === 90 ? '1h30min' : '50min'}
        </label>;
      })}
    </div>
  </fieldset>;
}
