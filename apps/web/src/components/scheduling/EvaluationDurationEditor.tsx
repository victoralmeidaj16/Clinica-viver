'use client';

import { useState } from 'react';
import { VariableDurationFields, variableDurationMinutes } from './VariableDurationFields';

interface Props {
  value: number;
  onChange: (value: number) => void;
}

export function EvaluationDurationEditor({ value, onChange }: Props) {
  const [manual, setManual] = useState(![50, 90].includes(value));
  const [hours, setHours] = useState(String(Math.floor(value / 60)));
  const [minutes, setMinutes] = useState(String(value % 60));

  const update = (nextHours: string, nextMinutes: string) => {
    setHours(nextHours);
    setMinutes(nextMinutes);
    const duration = variableDurationMinutes(nextHours, nextMinutes);
    onChange(Number.isFinite(duration) ? duration : 0);
  };

  return <div>
    <span className="mb-1 block text-xs font-bold text-ink">Duração *</span>
    <div className="grid grid-cols-3 gap-2">
      {([50, 90, 'manual'] as const).map((option) => <button key={option} type="button"
        aria-pressed={option === 'manual' ? manual : !manual && value === option}
        onClick={() => {
          setManual(option === 'manual');
          if (option === 'manual') {
            setHours(String(Math.floor(value / 60)));
            setMinutes(String(value % 60));
          } else {
            setHours(String(Math.floor(option / 60)));
            setMinutes(String(option % 60));
            onChange(option);
          }
        }}
        className={`rounded-xl border px-2 py-2 text-xs font-bold ${
          (option === 'manual' ? manual : !manual && value === option)
            ? 'border-psi-vibrant bg-psi-light text-psi-deep' : 'border-line bg-white text-muted'
        }`}>
        {option === 50 ? '50 min' : option === 90 ? '1h30' : 'Variável'}
      </button>)}
    </div>
    {manual && <VariableDurationFields hours={hours} minutes={minutes}
      onHoursChange={(next) => update(next, minutes)} onMinutesChange={(next) => update(hours, next)} />}
  </div>;
}
