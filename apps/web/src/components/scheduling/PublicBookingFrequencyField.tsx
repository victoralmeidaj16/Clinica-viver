'use client';

import { CalendarRange, Check } from 'lucide-react';
import type { PublicBookingFrequency } from '@/lib/publicBookingRecurrence';

const OPTIONS: Array<{ value: PublicBookingFrequency; label: string; hint: string }> = [
  { value: 'once', label: 'Única', hint: 'uma sessão' },
  { value: 'weekly', label: 'Semanal', hint: 'a cada 7 dias' },
  { value: 'biweekly', label: 'Quinzenal', hint: 'a cada 14 dias' },
  { value: 'custom', label: 'Personalizada', hint: 'escolha as datas' },
];

export function PublicBookingFrequencyField({ value, onChange }: { value: PublicBookingFrequency; onChange: (value: PublicBookingFrequency) => void }) {
  return (
    <fieldset>
      <legend className="flex items-center gap-2 text-xs font-black text-ink">
        <CalendarRange className="h-4 w-4 text-psi-vibrant" /> Frequência das sessões
      </legend>
      <div className="mt-2 grid grid-cols-2 gap-2 sm:grid-cols-4">
        {OPTIONS.map((option) => {
          const active = value === option.value;
          return (
            <button key={option.value} type="button" aria-pressed={active} onClick={() => onChange(option.value)}
              className={`relative rounded-2xl border px-2 py-3 text-left transition ${active ? 'border-psi-vibrant bg-psi-light text-psi-deep shadow-sm' : 'border-line bg-white text-muted hover:border-psi-vibrant/40'}`}>
              {active && <Check className="absolute right-2 top-2 h-3 w-3" />}
              <span className="block text-[11px] font-black">{option.label}</span>
              <span className="mt-0.5 block text-[9px]">{option.hint}</span>
            </button>
          );
        })}
      </div>
      <p className="mt-2 text-[10px] text-muted">
        {value === 'custom' ? 'Toque em cada data que deseja reservar.' : 'A recorrência usa o mesmo horário e termina no último dia disponível do mês.'}
      </p>
    </fieldset>
  );
}
