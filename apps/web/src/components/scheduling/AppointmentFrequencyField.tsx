'use client';

import { CalendarRange } from 'lucide-react';
import type { AppointmentFrequency } from '@/lib/manualAppointment';
import { todayAtClinic } from '@/lib/manualAppointment';
import { AppointmentDatesCalendar } from './AppointmentDatesCalendar';

const OPTIONS: Array<{ value: AppointmentFrequency; label: string; hint: string }> = [
  { value: 'weekly', label: 'Semanal', hint: 'a cada 7 dias' },
  { value: 'biweekly', label: 'Quinzenal', hint: 'a cada 14 dias' },
  { value: 'custom', label: 'Personalizado', hint: 'selecione os dias' },
];

interface Props {
  value: AppointmentFrequency;
  initialDate: string;
  dates: readonly string[];
  time: string;
  disabled?: boolean;
  onChange: (value: AppointmentFrequency) => void;
  onDatesChange: (dates: string[]) => void;
}

const shortDate = (date: string) => date.split('-').reverse().slice(0, 2).join('/');

export function AppointmentFrequencyField({ value, initialDate, dates, time, disabled, onChange, onDatesChange }: Props) {
  return (
    <fieldset disabled={disabled}>
      <legend className="flex items-center gap-1.5 text-xs font-bold text-ink">
        <CalendarRange className="h-4 w-4 text-psi-vibrant" /> Frequência
      </legend>
      <div className="mt-1.5 grid grid-cols-3 gap-2">
        {OPTIONS.map((option) => (
          <button
            key={option.value}
            type="button"
            onClick={() => onChange(option.value)}
            aria-pressed={value === option.value}
            className={`rounded-xl border px-2 py-2.5 text-center transition ${value === option.value ? 'border-psi-vibrant bg-psi-light text-psi-deep shadow-sm' : 'border-line bg-slate-50 text-muted hover:border-psi-vibrant/40'}`}
          >
            <span className="block text-[11px] font-extrabold">{option.label}</span>
            <span className="mt-0.5 block text-[9px] opacity-75">{option.hint}</span>
          </button>
        ))}
      </div>

      {value === 'custom' && (
        <AppointmentDatesCalendar initialDate={initialDate} minDate={todayAtClinic()} dates={dates} onChange={onDatesChange} />
      )}

      <div className="mt-3 rounded-xl border border-psi-soft bg-psi-light/60 px-3 py-2.5">
        <p className="text-[10px] font-black uppercase tracking-wider text-psi-deep">
          {dates.length} {dates.length === 1 ? 'sessão selecionada' : 'sessões selecionadas'}
        </p>
        <p className="mt-1 text-[11px] leading-relaxed text-psi-deep">
          {dates.map(shortDate).join(' • ')} às {time}
        </p>
      </div>
    </fieldset>
  );
}
