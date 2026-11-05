import React from 'react';
import type { AcessibilidadePsicologo } from '@/lib/psychologistAccessibility';

interface Props {
  value: AcessibilidadePsicologo | undefined;
  onChange: (value: AcessibilidadePsicologo | undefined) => void;
}

export function CadastroPsicologoAcessibilidade({ value, onChange }: Props) {
  return <fieldset className="space-y-2 rounded-2xl border border-purple-100 p-4">
    <legend className="font-bold text-slate-700">Acessibilidade do profissional</legend>
    <label htmlFor="psicologo-acessibilidade" className="block font-semibold text-slate-700">Você tem alguma necessidade de acessibilidade?</label>
    <select id="psicologo-acessibilidade" value={value ? (value.necessita ? 'SIM' : 'NAO') : ''}
      onChange={(event) => onChange(event.target.value ? { necessita: event.target.value === 'SIM' } : undefined)}
      className="input">
      <option value="">Prefiro não informar</option><option value="SIM">Sim</option><option value="NAO">Não</option>
    </select>
    {value?.necessita && <div>
      <label htmlFor="psicologo-acessibilidade-descricao" className="mb-1 block font-semibold text-slate-700">Qual adaptação ou recurso de acessibilidade você precisa? (opcional)</label>
      <textarea id="psicologo-acessibilidade-descricao" className="input" maxLength={1000} rows={3}
        value={value.descricao ?? ''} onChange={(event) => onChange({ necessita: true, descricao: event.target.value })} />
    </div>}
  </fieldset>;
}
