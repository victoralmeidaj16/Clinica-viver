'use client';

import { useId } from 'react';
import type { PatientAccessibility } from '@/lib/patientAccessibility';

interface Props {
  value?: PatientAccessibility | null;
  onChange: (value: PatientAccessibility | null) => void;
  disabled?: boolean;
}

export function PatientAccessibilityFields({ value, onChange, disabled }: Props) {
  const id = useId();
  return <fieldset disabled={disabled} className="space-y-2 rounded-2xl border border-line p-4">
    <legend className="px-1 text-sm font-bold text-ink">Acessibilidade do paciente</legend>
    <label htmlFor={id} className="block text-sm font-semibold text-ink">O paciente possui alguma deficiência ou necessidade de acessibilidade? (opcional)</label>
    <select id={id} className="input w-full" value={value ? value.necessita ? 'SIM' : 'NAO' : ''}
      onChange={(event) => onChange(event.target.value ? { necessita: event.target.value === 'SIM' } : null)}>
      <option value="">Prefiro não informar</option><option value="SIM">Sim</option><option value="NAO">Não</option>
    </select>
    {value?.necessita && <>
      <label htmlFor={`${id}-descricao`} className="block text-sm font-semibold text-ink">Qual adaptação ou recurso de acessibilidade é necessário? (opcional)</label>
      <textarea id={`${id}-descricao`} rows={3} maxLength={1000} className="input w-full" value={value.descricao ?? ''}
        onChange={(event) => onChange({ necessita: true, descricao: event.target.value })} />
      <p className="text-xs text-muted">Informe apenas o que ajuda a preparar o atendimento. Não é necessário informar diagnóstico.</p>
    </>}
  </fieldset>;
}
