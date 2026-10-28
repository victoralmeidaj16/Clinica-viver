'use client';

import { ChevronDown, Layers } from 'lucide-react';
import { VariableDurationFields } from './VariableDurationFields';
import type { CLINICAL_SERVICES } from '@/lib/manualAppointment';

interface Props {
  services: typeof CLINICAL_SERVICES;
  serviceKey: string;
  onServiceChange: (value: string) => void;
  variableDuration: boolean;
  manualDuration: boolean;
  durationPreset: 50 | 90 | 'manual';
  setDurationPreset: (value: 50 | 90 | 'manual') => void;
  customHours: string;
  customMinutes: string;
  setCustomHours: (value: string) => void;
  setCustomMinutes: (value: string) => void;
  disabled: boolean;
}
export function ManualAppointmentServiceFields({ services, serviceKey, onServiceChange, variableDuration, manualDuration,
  durationPreset, setDurationPreset, customHours, customMinutes, setCustomHours, setCustomMinutes, disabled }: Props) {
  return <>
          <label className="block text-xs font-bold text-ink">
            Serviço *
            <span className="relative mt-1.5 block">
              <Layers className="pointer-events-none absolute left-3.5 top-3.5 h-4 w-4 text-muted" />
              <select
                required
                value={serviceKey}
                onChange={(event) => {
                  onServiceChange(event.target.value);
                }}
                disabled={disabled}
                className="input w-full appearance-none py-3 pl-10 pr-10 text-xs font-bold"
              >
                {services.map((servico) => (
                  <option key={servico.key} value={servico.key}>
                    {servico.label} ({servico.variableDuration ? 'duração variável' : `${servico.durationMinutes} min`})
                  </option>
                ))}
              </select>
              <ChevronDown className="pointer-events-none absolute right-3.5 top-3.5 h-4 w-4 text-muted" />
            </span>
          </label>

          {variableDuration && (
            <fieldset disabled={disabled}>
              <legend className="text-xs font-bold text-ink">Duração da sessão *</legend>
              <div className="mt-1.5 grid grid-cols-3 gap-2">
                {([50, 90, 'manual'] as const).map((option) => {
                  const label = option === 50 ? '50min' : option === 90 ? '1h30min' : 'Definir outro tempo';
                  return (
                    <button
                      key={option}
                      type="button"
                      onClick={() => setDurationPreset(option)}
                      className={`rounded-xl border px-2 py-3 text-[11px] font-extrabold transition ${durationPreset === option ? 'border-psi-vibrant bg-psi-vibrant text-white shadow-md shadow-psi-vibrant/15' : 'border-line bg-slate-50 text-muted hover:border-psi-vibrant/40 hover:text-ink'}`}
                    >
                      {label}
                    </button>
                  );
                })}
              </div>
              {manualDuration && <VariableDurationFields hours={customHours} minutes={customMinutes}
                onHoursChange={setCustomHours} onMinutesChange={setCustomMinutes} />}
              <span className="mt-2 block text-[11px] font-medium text-muted">Na avaliação, psicólogo e gestão podem definir a duração de cada sessão.</span>
            </fieldset>
          )}

  </>;
}
