'use client';

import { MoonStar, Sun, Sunrise } from 'lucide-react';
import { TURNOS_ATENDIMENTO, type TurnoPreferencia } from '@/lib/turnos';

const ICONS = { MANHA: Sunrise, TARDE: Sun, NOITE: MoonStar } as const;

export function TurnoPreferenceField({
  value,
  onChange,
  name = 'turno',
  compact = false,
  allowedValues,
}: {
  value: TurnoPreferencia | '';
  onChange: (turno: TurnoPreferencia) => void;
  name?: string;
  compact?: boolean;
  allowedValues?: readonly TurnoPreferencia[];
}) {
  return (
    <fieldset className="space-y-2">
      <legend className="font-bold text-ink">
        Período de preferência <span className="text-rose-500">*</span>
      </legend>
      <p className="text-[11px] leading-relaxed text-muted">
        Essa escolha será cruzada com os turnos cadastrados pelos psicólogos.
      </p>
      <div className="grid grid-cols-3 gap-2">
        {TURNOS_ATENDIMENTO.map((turno) => {
          const Icon = ICONS[turno.value];
          const selected = value === turno.value;
          const disabled = Boolean(allowedValues && !allowedValues.includes(turno.value));
          return (
            <label
              key={turno.value}
              className={`group rounded-2xl border text-center transition-all ${compact ? 'p-2.5' : 'p-3'} ${disabled ? 'cursor-not-allowed border-line bg-slate-50 text-slate-300 opacity-60' : 'cursor-pointer'} ${
                selected
                  ? 'border-psi-vibrant bg-psi-vibrant/10 text-psi-deep shadow-sm ring-1 ring-psi-vibrant/20'
                  : disabled ? '' : 'border-line bg-white text-muted hover:border-psi-vibrant/50 hover:bg-psi-soft/30'
              }`}
            >
              <input
                type="radio"
                name={name}
                value={turno.value}
                checked={selected}
                disabled={disabled}
                required
                onChange={() => onChange(turno.value)}
                className="sr-only"
              />
              <Icon className={`mx-auto h-4 w-4 ${selected ? 'text-psi-vibrant' : 'text-slate-400 group-hover:text-psi-vibrant'}`} />
              <span className="mt-1.5 block text-xs font-black">{turno.label}</span>
              {!compact && <span className="mt-0.5 block text-[9px] font-medium">{turno.descricao}</span>}
            </label>
          );
        })}
      </div>
    </fieldset>
  );
}
