'use client';

import { ChevronDown, Layers } from 'lucide-react';
import { VariableDurationFields } from './VariableDurationFields';
import type { ClinicalServiceOption } from '@/lib/manualAppointment';

interface Props {
  services: readonly ClinicalServiceOption[];
  selectedService: ClinicalServiceOption;
  onServiceChange: (value: string) => void;
  manualDuration: boolean;
  durationPreset: 50 | 90 | 'manual';
  setDurationPreset: (value: 50 | 90 | 'manual') => void;
  customHours: string;
  customMinutes: string;
  setCustomHours: (value: string) => void;
  setCustomMinutes: (value: string) => void;
  disabled: boolean;
}
const evaluationDurations = [
  { minutes: 50, label: '50min' },
  { minutes: 90, label: '1h30min' },
  { minutes: 'manual', label: 'Definir outro tempo' },
] as const;

export function ManualAppointmentServiceFields({ services, selectedService, onServiceChange, manualDuration,
  durationPreset, setDurationPreset, customHours, customMinutes, setCustomHours, setCustomMinutes, disabled }: Props) {
  const options = selectedService.variableDuration ? evaluationDurations : selectedService.durationOptions;
  return <>
          <label className="block text-xs font-bold text-ink">
            Serviço *
            <span className="relative mt-1.5 block">
              <Layers className="pointer-events-none absolute left-3.5 top-3.5 h-4 w-4 text-muted" />
              <select
                required
                value={selectedService.key}
                onChange={(event) => {
                  onServiceChange(event.target.value);
                }}
                disabled={disabled}
                className="input w-full appearance-none py-3 pl-10 pr-10 text-xs font-bold"
              >
                {services.map((servico) => (
                  <option key={servico.key} value={servico.key}>
                    {servico.label} ({servico.variableDuration ? 'duração variável' : servico.durationOptions
                      ? servico.durationOptions.map((option) => option.minutes).join(' ou ') + ' min'
                      : `${servico.durationMinutes} min`})
                  </option>
                ))}
              </select>
              <ChevronDown className="pointer-events-none absolute right-3.5 top-3.5 h-4 w-4 text-muted" />
            </span>
          </label>

          {options && (
            <fieldset disabled={disabled}>
              <legend className="text-xs font-bold text-ink">Duração da sessão *</legend>
              <div className={`mt-1.5 grid gap-2 ${selectedService.variableDuration ? 'grid-cols-3' : 'grid-cols-2'}`}>
                {options.map(({ minutes, label }) => (
                    <button
                      key={minutes}
                      type="button"
                      aria-pressed={durationPreset === minutes}
                      onClick={() => setDurationPreset(minutes)}
                      className={`rounded-xl border px-2 py-3 text-[11px] font-extrabold transition ${durationPreset === minutes ? 'border-psi-vibrant bg-psi-vibrant text-white shadow-md shadow-psi-vibrant/15' : 'border-line bg-slate-50 text-muted hover:border-psi-vibrant/40 hover:text-ink'}`}
                    >
                      {label}
                    </button>
                ))}
              </div>
              {manualDuration && <VariableDurationFields hours={customHours} minutes={customMinutes}
                onHoursChange={setCustomHours} onMinutesChange={setCustomMinutes} />}
              {selectedService.variableDuration && <span className="mt-2 block text-[11px] font-medium text-muted">Na avaliação, psicólogo e gestão podem definir a duração de cada sessão.</span>}
            </fieldset>
          )}

  </>;
}
